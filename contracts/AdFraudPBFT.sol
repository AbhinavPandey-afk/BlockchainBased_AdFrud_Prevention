// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
  AdFraudPBFT.sol
  - Works on EVM (PBFT/IBFT chains or public chains)
  - Two click submission flows:
      1) Direct: registered Gateway calls submitClickGatewayDirect(...)
      2) Signed: Gateway signs off-chain; any relayer calls submitClickWithSig(...)
  - Uses OpenZeppelin v4.9.3 imports (pinned)
*/

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AdFraudPBFT is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;

    // Roles
    bytes32 public constant GATEWAY_ROLE = keccak256("GATEWAY_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // Events
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event GatewayStaked(address indexed gateway, uint256 amount, uint256 totalStake);
    event GatewayUnstaked(address indexed gateway, uint256 amount, uint256 totalStake);
    event GatewaySlashed(address indexed gateway, uint256 slashAmount, bytes32 evidenceCIDHash);

    event CampaignCreated(uint256 indexed campaignId, address indexed advertiser, uint256 cpcWei, uint256 initialBudget, string meta);
    event CampaignFunded(uint256 indexed campaignId, uint256 amount, uint256 newBudget);
    event CampaignPaused(uint256 indexed campaignId, bool paused);

    event ClickRecorded(
        bytes32 indexed clickHash,
        uint256 indexed campaignId,
        address indexed publisher,
        address gateway,
        uint256 cpcWei,
        uint256 timestamp,
        bytes32 metadataCIDHash
    );

    event PublisherWithdrawal(address indexed publisher, uint256 amount);

    // Data
    struct Campaign {
        address advertiser;
        uint256 cpcWei;
        uint256 budgetWei;
        bool paused;
        string meta;
    }

    mapping(address => uint256) public stakeOf;
    mapping(uint256 => Campaign) public campaigns;
    uint256 public nextCampaignId;
    mapping(bytes32 => bool) public usedClickHash;
    mapping(address => uint256) public publisherBalance;

    uint256 public minGatewayStakeWei = 0.5 ether;
    address public treasury;

    // timestamp replay protection
    uint256 public maxClickAgeSeconds = 86400; // 1 day
    uint256 public maxClickFutureSeconds = 120; // 2 minutes

    modifier onlyAdminOrAuditor() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(AUDITOR_ROLE, _msgSender()), "Not admin/auditor");
        _;
    }

    constructor(address _treasury) {
        require(_treasury != address(0), "Treasury required");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        treasury = _treasury;
        emit TreasuryChanged(address(0), _treasury);
    }

    // --- Admin setters ---
    function setMinGatewayStake(uint256 newMin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minGatewayStakeWei = newMin;
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Zero address");
        emit TreasuryChanged(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setMaxClickAgeSeconds(uint256 secs) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxClickAgeSeconds = secs;
    }
    function setMaxClickFutureSeconds(uint256 secs) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxClickFutureSeconds = secs;
    }

    // --- Gateway staking ---
    function stakeGateway() external payable onlyRole(GATEWAY_ROLE) {
        require(msg.value > 0, "No ETH sent");
        stakeOf[msg.sender] += msg.value;
        emit GatewayStaked(msg.sender, msg.value, stakeOf[msg.sender]);
    }

    function unstakeGateway(uint256 amount) external nonReentrant onlyRole(GATEWAY_ROLE) {
        require(amount > 0 && amount <= stakeOf[msg.sender], "Invalid amount");
        uint256 remaining = stakeOf[msg.sender] - amount;
        // either fully unstake or keep >= minGatewayStakeWei
        require(remaining == 0 || remaining >= minGatewayStakeWei, "Below min stake");
        stakeOf[msg.sender] = remaining;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit GatewayUnstaked(msg.sender, amount, remaining);
    }

    // Slash by basis points (bps). 10000 bps = 100%
    function slashGateway(address gateway, uint16 pctBps, bytes32 evidenceCIDHash) external onlyAdminOrAuditor {
        require(gateway != address(0), "Invalid gateway");
        require(pctBps > 0 && pctBps <= 10000, "Bps out of range");
        uint256 stake = stakeOf[gateway];
        require(stake > 0, "No stake");
        uint256 slashAmt = (stake * pctBps) / 10000;
        stakeOf[gateway] = stake - slashAmt;
        (bool ok, ) = payable(treasury).call{value: slashAmt}("");
        require(ok, "Slash transfer failed");
        emit GatewaySlashed(gateway, slashAmt, evidenceCIDHash);
    }

    // --- Campaigns ---
    function createCampaign(uint256 cpcWei, string calldata meta) external payable returns (uint256 id) {
        require(cpcWei > 0, "CPC must be > 0");
        require(msg.value > 0, "Initial budget required");
        id = nextCampaignId++;
        campaigns[id] = Campaign({
            advertiser: msg.sender,
            cpcWei: cpcWei,
            budgetWei: msg.value,
            paused: false,
            meta: meta
        });
        emit CampaignCreated(id, msg.sender, cpcWei, msg.value, meta);
    }

    function fundCampaign(uint256 campaignId) external payable {
        Campaign storage c = campaigns[campaignId];
        require(c.advertiser != address(0), "Campaign missing");
        require(msg.value > 0, "No funds");
        c.budgetWei += msg.value;
        emit CampaignFunded(campaignId, msg.value, c.budgetWei);
    }

    function setCampaignPaused(uint256 campaignId, bool paused) external {
        Campaign storage c = campaigns[campaignId];
        require(c.advertiser == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        c.paused = paused;
        emit CampaignPaused(campaignId, paused);
    }

    // --- Click submission helpers ---
    // Include chainId + contract address in hash to avoid cross-contract replay
    function computeClickMessageHash(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        address gateway,
        uint256 timestamp,
        bytes32 metadataCIDHash
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(block.chainid, address(this), "AD_CLICK_V1", clickHash, campaignId, publisher, gateway, timestamp, metadataCIDHash));
    }

    // Direct gateway submission (gateway sends tx)
    function submitClickGatewayDirect(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        uint256 timestamp,
        bytes32 metadataCIDHash
    ) external onlyRole(GATEWAY_ROLE) {
        _submitClickCore(clickHash, campaignId, publisher, msg.sender, timestamp, metadataCIDHash);
    }

    // Signed submission: gateway signs the computeClickMessageHash(...) off-chain.
    // Any relayer can call this with the signature.
    function submitClickWithSig(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        address gateway,
        uint256 timestamp,
        bytes32 metadataCIDHash,
        bytes calldata signature
    ) external {
        bytes32 rawHash = computeClickMessageHash(clickHash, campaignId, publisher, gateway, timestamp, metadataCIDHash);
        bytes32 ethSigned = ECDSA.toEthSignedMessageHash(rawHash); // v4.9.3 supports bytes32 overload
        address recovered = ECDSA.recover(ethSigned, signature);
        require(recovered == gateway, "Invalid signature");
        require(hasRole(GATEWAY_ROLE, gateway), "Signer not gateway");

        // timestamp replay protection
        if (timestamp > block.timestamp) {
            require(timestamp - block.timestamp <= maxClickFutureSeconds, "Timestamp too far in future");
        } else {
            require(block.timestamp - timestamp <= maxClickAgeSeconds, "Timestamp too old");
        }

        _submitClickCore(clickHash, campaignId, publisher, gateway, timestamp, metadataCIDHash);
    }

    // core shared logic
    function _submitClickCore(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        address gateway,
        uint256 timestamp,
        bytes32 metadataCIDHash
    ) internal {
        require(publisher != address(0), "Zero publisher");
        require(!usedClickHash[clickHash], "Duplicate click");
        Campaign storage c = campaigns[campaignId];
        require(c.advertiser != address(0), "Campaign missing");
        require(!c.paused, "Campaign paused");
        require(c.budgetWei >= c.cpcWei, "Insufficient budget");

        usedClickHash[clickHash] = true; // effects before interactions
        c.budgetWei -= c.cpcWei;
        publisherBalance[publisher] += c.cpcWei;

        emit ClickRecorded(clickHash, campaignId, publisher, gateway, c.cpcWei, timestamp, metadataCIDHash);
    }

    // Publisher withdraw
    function withdrawPublisher(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= publisherBalance[msg.sender], "Invalid amount");
        publisherBalance[msg.sender] -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit PublisherWithdrawal(msg.sender, amount);
    }

    // Views
    function getCampaign(uint256 campaignId) external view returns (
        address advertiser,
        uint256 cpcWei,
        uint256 budgetWei,
        bool paused,
        string memory meta
    ) {
        Campaign storage c = campaigns[campaignId];
        return (c.advertiser, c.cpcWei, c.budgetWei, c.paused, c.meta);
    }

    // allow receiving ETH (for funding)
    receive() external payable {}
    fallback() external payable {}
}
