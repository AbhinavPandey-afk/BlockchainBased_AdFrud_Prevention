// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AdFraudPBFT is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;

    // Roles
    bytes32 public constant GATEWAY_ROLE = keccak256("GATEWAY_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant PBFT_NODE_ROLE = keccak256("PBFT_NODE_ROLE");

    // Original Events
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

    // PBFT Events
    event PBFTNodeAdded(address indexed node, uint256 stake);
    event PBFTNodeRemoved(address indexed node);
    event TransactionProposed(bytes32 indexed txHash, uint256 indexed campaignId, address indexed publisher);
    event ConsensusVote(bytes32 indexed txHash, address indexed node, bool vote);
    event ConsensusReached(bytes32 indexed txHash, bool approved, uint256 voteCount);
    event TransactionExecuted(bytes32 indexed txHash, uint256 indexed campaignId, address indexed publisher);

    // Original Data Structures
    struct Campaign {
        address advertiser;
        uint256 cpcWei;
        uint256 budgetWei;
        bool paused;
        string meta;
    }

    // PBFT Data Structures
    struct PBFTNode {
        address nodeAddress;
        bool isActive;
        uint256 stake;
        uint256 votesParticipated;
        uint256 correctVotes;
    }

    struct PendingTransaction {
        bytes32 txHash;
        uint256 campaignId;
        address publisher;
        address gateway;
        uint256 timestamp;
        bytes32 metadataCIDHash;
        uint256 approveVotes;
        uint256 rejectVotes;
        uint256 totalVotes;
        uint256 requiredVotes;
        bool executed;
        bool consensusReached;
        uint256 proposalTime;
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteValue; // true = approve, false = reject
    }

    // Original Storage
    mapping(address => uint256) public stakeOf;
    mapping(uint256 => Campaign) public campaigns;
    uint256[] public campaignIds;
    mapping(bytes32 => bool) public usedClickHash;
    mapping(address => uint256) public publisherBalance;

    // PBFT Storage
    mapping(address => PBFTNode) public pbftNodes;
    address[] public activeNodes;
    mapping(bytes32 => PendingTransaction) public pendingTransactions;
    bytes32[] public pendingTxHashes;
    uint256 public requiredConsensusPercentage = 67; // 67% required for consensus
    uint256 public consensusTimeoutSeconds = 600; // 10 minutes timeout
    uint256 public minPBFTStake = 1 ether;

    // Original Configuration
    uint256 public minGatewayStakeWei = 0.5 ether;
    address public treasury;
    uint256 public maxClickAgeSeconds = 86400; // 1 day
    uint256 public maxClickFutureSeconds = 120; // 2 minutes

    modifier onlyAdminOrAuditor() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(AUDITOR_ROLE, _msgSender()),
            "Not admin/auditor"
        );
        _;
    }

    modifier onlyActivePBFTNode() {
        require(hasRole(PBFT_NODE_ROLE, msg.sender), "Not PBFT node");
        require(pbftNodes[msg.sender].isActive, "Node not active");
        _;
    }

    constructor(address _treasury) {
        require(_treasury != address(0), "Treasury required");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        treasury = _treasury;
        emit TreasuryChanged(address(0), _treasury);
    }

    // --- Original Admin Functions ---
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

    // --- PBFT Configuration Functions ---
    function setRequiredConsensusPercentage(uint256 percentage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(percentage > 50 && percentage <= 100, "Invalid percentage");
        requiredConsensusPercentage = percentage;
    }

    function setConsensusTimeout(uint256 timeoutSeconds) external onlyRole(DEFAULT_ADMIN_ROLE) {
        consensusTimeoutSeconds = timeoutSeconds;
    }

    function setMinPBFTStake(uint256 minStake) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minPBFTStake = minStake;
    }

    // --- PBFT Node Management ---
    function addPBFTNode(address node) 
        external 
        payable 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(node != address(0), "Invalid node address");
        require(msg.value >= minPBFTStake, "Insufficient stake");
        require(!pbftNodes[node].isActive, "Node already active");
        
        pbftNodes[node] = PBFTNode({
            nodeAddress: node,
            isActive: true,
            stake: msg.value,
            votesParticipated: 0,
            correctVotes: 0
        });
        
        activeNodes.push(node);
        _grantRole(PBFT_NODE_ROLE, node);
        
        emit PBFTNodeAdded(node, msg.value);
    }

    function removePBFTNode(address node) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pbftNodes[node].isActive, "Node not active");
        
        pbftNodes[node].isActive = false;
        _revokeRole(PBFT_NODE_ROLE, node);
        
        // Remove from active nodes array
        for (uint256 i = 0; i < activeNodes.length; i++) {
            if (activeNodes[i] == node) {
                activeNodes[i] = activeNodes[activeNodes.length - 1];
                activeNodes.pop();
                break;
            }
        }
        
        // Refund stake
        uint256 stake = pbftNodes[node].stake;
        pbftNodes[node].stake = 0;
        (bool ok, ) = payable(node).call{value: stake}("");
        require(ok, "Stake refund failed");
        
        emit PBFTNodeRemoved(node);
    }

    function stakePBFTNode() external payable onlyRole(PBFT_NODE_ROLE) {
        require(msg.value > 0, "No ETH sent");
        require(pbftNodes[msg.sender].isActive, "Node not active");
        pbftNodes[msg.sender].stake += msg.value;
    }

    // --- Original Gateway Functions ---
    function stakeGateway() external payable onlyRole(GATEWAY_ROLE) {
        require(msg.value > 0, "No ETH sent");
        stakeOf[msg.sender] += msg.value;
        emit GatewayStaked(msg.sender, msg.value, stakeOf[msg.sender]);
    }

    function unstakeGateway(uint256 amount) external nonReentrant onlyRole(GATEWAY_ROLE) {
        require(amount > 0 && amount <= stakeOf[msg.sender], "Invalid amount");
        uint256 remaining = stakeOf[msg.sender] - amount;
        require(remaining == 0 || remaining >= minGatewayStakeWei, "Below min stake");
        stakeOf[msg.sender] = remaining;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit GatewayUnstaked(msg.sender, amount, remaining);
    }

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

    // --- Original Campaign Functions ---
    function createCampaign(
        uint256 campaignId,
        uint256 cpcWei,
        string calldata meta
    ) external payable returns (uint256 id) {
        require(cpcWei > 0, "CPC must be > 0");
        require(msg.value > 0, "Initial budget required");
        require(campaigns[campaignId].advertiser == address(0), "Campaign ID already exists");

        campaigns[campaignId] = Campaign({
            advertiser: msg.sender,
            cpcWei: cpcWei,
            budgetWei: msg.value,
            paused: false,
            meta: meta
        });

        campaignIds.push(campaignId);
        emit CampaignCreated(campaignId, msg.sender, cpcWei, msg.value, meta);
        return campaignId;
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
        require(
            c.advertiser == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        c.paused = paused;
        emit CampaignPaused(campaignId, paused);
    }

    // --- PBFT Transaction Processing ---
    function proposeTransaction(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        uint256 timestamp,
        bytes32 metadataCIDHash
    ) public onlyRole(GATEWAY_ROLE) returns (bytes32) {
        require(activeNodes.length >= 3, "Insufficient PBFT nodes");
        require(pendingTransactions[clickHash].txHash == bytes32(0), "Transaction already proposed");
        
        // Validate transaction basics
        require(publisher != address(0), "Zero publisher");
        require(!usedClickHash[clickHash], "Duplicate click");
        Campaign storage c = campaigns[campaignId];
        require(c.advertiser != address(0), "Campaign missing");
        require(!c.paused, "Campaign paused");
        require(c.budgetWei >= c.cpcWei, "Insufficient budget");
        
        // Calculate required votes (percentage of active nodes)
        uint256 requiredVotes = (activeNodes.length * requiredConsensusPercentage) / 100;
        if (requiredVotes == 0) requiredVotes = 1;
        
        // Create pending transaction
        PendingTransaction storage pendingTx = pendingTransactions[clickHash];
        pendingTx.txHash = clickHash;
        pendingTx.campaignId = campaignId;
        pendingTx.publisher = publisher;
        pendingTx.gateway = msg.sender;
        pendingTx.timestamp = timestamp;
        pendingTx.metadataCIDHash = metadataCIDHash;
        pendingTx.requiredVotes = requiredVotes;
        pendingTx.proposalTime = block.timestamp;
        
        pendingTxHashes.push(clickHash);
        
        emit TransactionProposed(clickHash, campaignId, publisher);
        return clickHash;
    }

    function voteOnTransaction(bytes32 txHash, bool approve) 
        external 
        onlyActivePBFTNode 
    {
        PendingTransaction storage pendingTx = pendingTransactions[txHash];
        require(pendingTx.txHash != bytes32(0), "Transaction not found");
        require(!pendingTx.executed, "Transaction already executed");
        require(!pendingTx.consensusReached, "Consensus already reached");
        require(!pendingTx.hasVoted[msg.sender], "Already voted");
        require(
            block.timestamp <= pendingTx.proposalTime + consensusTimeoutSeconds,
            "Voting period expired"
        );
        
        pendingTx.hasVoted[msg.sender] = true;
        pendingTx.voteValue[msg.sender] = approve;
        pendingTx.totalVotes++;
        
        if (approve) {
            pendingTx.approveVotes++;
        } else {
            pendingTx.rejectVotes++;
        }
        
        // Update node statistics
        pbftNodes[msg.sender].votesParticipated++;
        
        emit ConsensusVote(txHash, msg.sender, approve);
        
        // Check if consensus reached
        if (pendingTx.approveVotes >= pendingTx.requiredVotes) {
            pendingTx.consensusReached = true;
            _executeTransaction(txHash);
            emit ConsensusReached(txHash, true, pendingTx.approveVotes);
        } else if (pendingTx.rejectVotes >= pendingTx.requiredVotes) {
            pendingTx.consensusReached = true;
            emit ConsensusReached(txHash, false, pendingTx.rejectVotes);
        } else if (pendingTx.totalVotes == activeNodes.length) {
            // All nodes voted but no consensus reached
            pendingTx.consensusReached = true;
            emit ConsensusReached(txHash, false, pendingTx.approveVotes);
        }
    }

    function _executeTransaction(bytes32 txHash) internal {
        PendingTransaction storage pendingTx = pendingTransactions[txHash];
        require(!pendingTx.executed, "Already executed");
        require(pendingTx.consensusReached, "Consensus not reached");
        require(pendingTx.approveVotes >= pendingTx.requiredVotes, "Insufficient approval votes");
        
        pendingTx.executed = true;
        
        // Execute the click transaction
        usedClickHash[pendingTx.txHash] = true;
        Campaign storage c = campaigns[pendingTx.campaignId];
        c.budgetWei -= c.cpcWei;
        publisherBalance[pendingTx.publisher] += c.cpcWei;
        
        // Update correct vote statistics for nodes that voted to approve
        for (uint256 i = 0; i < activeNodes.length; i++) {
            address node = activeNodes[i];
            if (pendingTx.hasVoted[node] && pendingTx.voteValue[node]) {
                pbftNodes[node].correctVotes++;
            }
        }
        
        emit ClickRecorded(
            pendingTx.txHash, 
            pendingTx.campaignId, 
            pendingTx.publisher, 
            pendingTx.gateway, 
            c.cpcWei, 
            pendingTx.timestamp, 
            pendingTx.metadataCIDHash
        );
        
        emit TransactionExecuted(txHash, pendingTx.campaignId, pendingTx.publisher);
    }

    // --- Timeout and Cleanup Functions ---
    function cleanupExpiredTransaction(bytes32 txHash) external {
        PendingTransaction storage pendingTx = pendingTransactions[txHash];
        require(pendingTx.txHash != bytes32(0), "Transaction not found");
        require(!pendingTx.executed, "Transaction already executed");
        require(
            block.timestamp > pendingTx.proposalTime + consensusTimeoutSeconds,
            "Transaction not expired"
        );
        
        if (!pendingTx.consensusReached) {
            pendingTx.consensusReached = true;
            emit ConsensusReached(txHash, false, pendingTx.approveVotes);
        }
        
        // Remove from pending array
        for (uint256 i = 0; i < pendingTxHashes.length; i++) {
            if (pendingTxHashes[i] == txHash) {
                pendingTxHashes[i] = pendingTxHashes[pendingTxHashes.length - 1];
                pendingTxHashes.pop();
                break;
            }
        }
    }

    // --- Original Helper Functions ---
    function computeClickMessageHash(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        address gateway,
        uint256 timestamp,
        bytes32 metadataCIDHash
    ) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                "AD_CLICK_V1",
                clickHash,
                campaignId,
                publisher,
                gateway,
                timestamp,
                metadataCIDHash
            )
        );
    }

    // --- Legacy Direct Submission (for backwards compatibility) ---
    function submitClickGatewayDirect(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        uint256 timestamp,
        bytes32 metadataCIDHash
    ) external onlyRole(GATEWAY_ROLE) {
        // For backwards compatibility, directly propose to PBFT
        proposeTransaction(clickHash, campaignId, publisher, timestamp, metadataCIDHash);
    }

    function submitClickWithSig(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        address gateway,
        uint256 timestamp,
        bytes32 metadataCIDHash,
        bytes calldata signature
    ) external {
        bytes32 rawHash = computeClickMessageHash(
            clickHash,
            campaignId,
            publisher,
            gateway,
            timestamp,
            metadataCIDHash
        );
        bytes32 ethSigned = ECDSA.toEthSignedMessageHash(rawHash);
        address recovered = ECDSA.recover(ethSigned, signature);
        require(recovered == gateway, "Invalid signature");
        require(hasRole(GATEWAY_ROLE, gateway), "Signer not gateway");

        if (timestamp > block.timestamp) {
            require(timestamp - block.timestamp <= maxClickFutureSeconds, "Timestamp too far in future");
        } else {
            require(block.timestamp - timestamp <= maxClickAgeSeconds, "Timestamp too old");
        }

        // Propose to PBFT instead of direct execution
        proposeTransaction(clickHash, campaignId, publisher, timestamp, metadataCIDHash);
    }

    // --- Publisher Functions ---
    function withdrawPublisher(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= publisherBalance[msg.sender], "Invalid amount");
        publisherBalance[msg.sender] -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit PublisherWithdrawal(msg.sender, amount);
    }

    // --- View Functions ---
    function getCampaign(uint256 campaignId)
        external
        view
        returns (
            address advertiser,
            uint256 cpcWei,
            uint256 budgetWei,
            bool paused,
            string memory meta
        )
    {
        Campaign storage c = campaigns[campaignId];
        return (c.advertiser, c.cpcWei, c.budgetWei, c.paused, c.meta);
    }

    function getCampaignIds() external view returns (uint256[] memory) {
        return campaignIds;
    }

    function getActiveNodes() external view returns (address[] memory) {
        return activeNodes;
    }

    function getPendingTransactionHashes() external view returns (bytes32[] memory) {
        return pendingTxHashes;
    }

    function getPendingTransactionDetails(bytes32 txHash) 
        external 
        view 
        returns (
            uint256 campaignId,
            address publisher,
            address gateway,
            uint256 approveVotes,
            uint256 rejectVotes,
            uint256 totalVotes,
            uint256 requiredVotes,
            bool executed,
            bool consensusReached,
            uint256 proposalTime
        ) 
    {
        PendingTransaction storage pendingTx = pendingTransactions[txHash];
        return (
            pendingTx.campaignId,
            pendingTx.publisher,
            pendingTx.gateway,
            pendingTx.approveVotes,
            pendingTx.rejectVotes,
            pendingTx.totalVotes,
            pendingTx.requiredVotes,
            pendingTx.executed,
            pendingTx.consensusReached,
            pendingTx.proposalTime
        );
    }

    function hasNodeVoted(bytes32 txHash, address node) external view returns (bool) {
        return pendingTransactions[txHash].hasVoted[node];
    }

    function getNodeVote(bytes32 txHash, address node) external view returns (bool) {
        require(pendingTransactions[txHash].hasVoted[node], "Node has not voted");
        return pendingTransactions[txHash].voteValue[node];
    }

    function getNodeStats(address node) 
        external 
        view 
        returns (
            bool isActive,
            uint256 stake,
            uint256 votesParticipated,
            uint256 correctVotes,
            uint256 accuracyPercentage
        ) 
    {
        PBFTNode storage pbftNode = pbftNodes[node];
        uint256 accuracy = 0;
        if (pbftNode.votesParticipated > 0) {
            accuracy = (pbftNode.correctVotes * 100) / pbftNode.votesParticipated;
        }
        
        return (
            pbftNode.isActive,
            pbftNode.stake,
            pbftNode.votesParticipated,
            pbftNode.correctVotes,
            accuracy
        );
    }

    receive() external payable {}
    fallback() external payable {}
}
