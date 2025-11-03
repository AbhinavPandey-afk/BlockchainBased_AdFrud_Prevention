// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AdFraudPBFT {
    // Minimal ECDSA recovery
    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid signature 'v' value");
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    // Role mappings
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isGateway;
    mapping(address => bool) public isAuditor;
    mapping(address => bool) public isPbftNode;

    // NEW: advertiser/publisher roles
    mapping(address => bool) public isAdvertiser;
    mapping(address => bool) public isPublisher;

    address public admin;

    // Role events
    event AdminAssigned(address indexed account);
    event AdminRevoked(address indexed account);
    event GatewayAssigned(address indexed account);
    event GatewayRevoked(address indexed account);
    event AuditorAssigned(address indexed account);
    event AuditorRevoked(address indexed account);
    event PbftNodeAssigned(address indexed account);
    event PbftNodeRevoked(address indexed account);
    // NEW role events
    event AdvertiserAssigned(address indexed account);
    event AdvertiserRevoked(address indexed account);
    event PublisherAssigned(address indexed account);
    event PublisherRevoked(address indexed account);

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

    // Data structures
    struct Campaign {
        address advertiser;
        uint256 cpcWei;
        uint256 budgetWei;
        bool paused;
        string meta;
    }

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
        mapping(address => bool) voteValue;
    }

    // Storage
    mapping(address => uint256) public stakeOf;
    mapping(uint256 => Campaign) public campaigns;
    uint256[] public campaignIds;
    mapping(bytes32 => bool) public usedClickHash;
    mapping(address => uint256) public publisherBalance;

    mapping(address => PBFTNode) public pbftNodes;
    address[] public activeNodes;
    mapping(bytes32 => PendingTransaction) public pendingTransactions;
    bytes32[] public pendingTxHashes;

    uint256 public requiredConsensusPercentage = 67;
    uint256 public consensusTimeoutSeconds = 600;

    // CHANGED: default min PBFT stake set to 0.0000001 ETH
    uint256 public minPBFTStake = 100_000_000_000; // 1e11 wei = 0.0000001 ether

    uint256 public minGatewayStakeWei = 0.5 ether;
    address public treasury;
    uint256 public maxClickAgeSeconds = 86400;
    uint256 public maxClickFutureSeconds = 120;

    // Modifiers
    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not admin");
        _;
    }

    modifier onlyGateway() {
        require(isGateway[msg.sender], "Not gateway");
        _;
    }

    modifier onlyAuditor() {
        require(isAuditor[msg.sender], "Not auditor");
        _;
    }

    modifier onlyPbftNode() {
        require(isPbftNode[msg.sender], "Not PBFT node");
        _;
    }

    modifier onlyAdminOrAuditor() {
        require(isAdmin[msg.sender] || isAuditor[msg.sender], "Not admin or auditor");
        _;
    }

    modifier onlyActivePbftNode() {
        require(isPbftNode[msg.sender], "Not PBFT node");
        require(pbftNodes[msg.sender].isActive, "Node not active");
        _;
    }

    constructor(address _treasury) {
        require(_treasury != address(0), "Treasury required");
        admin = msg.sender;
        isAdmin[admin] = true;
        treasury = _treasury;
        emit TreasuryChanged(address(0), _treasury);
    }

    // Role management
    function assignAdmin(address account) external onlyAdmin {
        isAdmin[account] = true;
        emit AdminAssigned(account);
    }

    function revokeAdmin(address account) external onlyAdmin {
        isAdmin[account] = false;
        emit AdminRevoked(account);
    }

    function assignGateway(address account) external onlyAdmin {
        isGateway[account] = true;
        emit GatewayAssigned(account);
    }

    function revokeGateway(address account) external onlyAdmin {
        isGateway[account] = false;
        emit GatewayRevoked(account);
    }

    function assignAuditor(address account) external onlyAdmin {
        isAuditor[account] = true;
        emit AuditorAssigned(account);
    }

    function revokeAuditor(address account) external onlyAdmin {
        isAuditor[account] = false;
        emit AuditorRevoked(account);
    }

    function assignPbftNode(address account) external onlyAdmin {
        isPbftNode[account] = true;
        emit PbftNodeAssigned(account);
    }

    function revokePbftNode(address account) external onlyAdmin {
        isPbftNode[account] = false;
        emit PbftNodeRevoked(account);
    }

    // NEW: advertiser/publisher role management
    function assignAdvertiser(address account) external onlyAdmin {
        isAdvertiser[account] = true;
        emit AdvertiserAssigned(account);
    }

    function revokeAdvertiser(address account) external onlyAdmin {
        isAdvertiser[account] = false;
        emit AdvertiserRevoked(account);
    }

    function assignPublisher(address account) external onlyAdmin {
        isPublisher[account] = true;
        emit PublisherAssigned(account);
    }

    function revokePublisher(address account) external onlyAdmin {
        isPublisher[account] = false;
        emit PublisherRevoked(account);
    }

    // Admin config
    function setMinGatewayStake(uint256 newMin) external onlyAdmin {
        minGatewayStakeWei = newMin;
    }

    function setTreasury(address newTreasury) external onlyAdmin {
        require(newTreasury != address(0), "Zero address");
        emit TreasuryChanged(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setMaxClickAgeSeconds(uint256 secs) external onlyAdmin {
        maxClickAgeSeconds = secs;
    }

    function setMaxClickFutureSeconds(uint256 secs) external onlyAdmin {
        maxClickFutureSeconds = secs;
    }

    // PBFT configuration
    function setRequiredConsensusPercentage(uint256 percentage) external onlyAdmin {
        require(percentage > 50 && percentage <= 100, "Invalid percentage");
        requiredConsensusPercentage = percentage;
    }

    function setConsensusTimeout(uint256 timeoutSeconds) external onlyAdmin {
        consensusTimeoutSeconds = timeoutSeconds;
    }

    function setMinPBFTStake(uint256 minStake) external onlyAdmin {
        minPBFTStake = minStake;
    }

    // PBFT node management
    function addPBFTNode(address node) external payable onlyAdmin {
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

        isPbftNode[node] = true;
        emit PbftNodeAssigned(node);

        emit PBFTNodeAdded(node, msg.value);
    }

    function removePBFTNode(address node) external onlyAdmin {
        require(pbftNodes[node].isActive, "Node not active");

        pbftNodes[node].isActive = false;
        isPbftNode[node] = false;
        emit PbftNodeRevoked(node);

        for (uint256 i = 0; i < activeNodes.length; i++) {
            if (activeNodes[i] == node) {
                activeNodes[i] = activeNodes[activeNodes.length - 1];
                activeNodes.pop();
                break;
            }
        }

        uint256 stake = pbftNodes[node].stake;
        pbftNodes[node].stake = 0;
        (bool ok, ) = payable(node).call{value: stake}("");
        require(ok, "Stake refund failed");

        emit PBFTNodeRemoved(node);
    }

    function stakePBFTNode() external payable onlyPbftNode {
        require(pbftNodes[msg.sender].isActive, "Node not active");
        pbftNodes[msg.sender].stake += msg.value;
    }

    // Gateway staking
    function stakeGateway() external payable onlyGateway {
        require(msg.value > 0, "No ETH sent");
        stakeOf[msg.sender] += msg.value;
        emit GatewayStaked(msg.sender, msg.value, stakeOf[msg.sender]);
    }

    function unstakeGateway(uint256 amount) external onlyGateway {
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

    // Campaigns
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
        require(c.advertiser == msg.sender || isAdmin[msg.sender], "Not authorized");
        c.paused = paused;
        emit CampaignPaused(campaignId, paused);
    }

    // PBFT transaction processing
    function proposeTransaction(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        uint256 timestamp,
        bytes32 metadataCIDHash
    ) public onlyGateway returns (bytes32) {
        require(activeNodes.length >= 3, "Insufficient PBFT nodes");
        require(pendingTransactions[clickHash].txHash == bytes32(0), "Transaction already proposed");

        require(publisher != address(0), "Zero publisher");
        require(!usedClickHash[clickHash], "Duplicate click");
        Campaign storage c = campaigns[campaignId];
        require(c.advertiser != address(0), "Campaign missing");
        require(!c.paused, "Campaign paused");
        require(c.budgetWei >= c.cpcWei, "Insufficient budget");

        uint256 requiredVotes = (activeNodes.length * requiredConsensusPercentage) / 100;
        if (requiredVotes == 0) requiredVotes = 1;

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

    function voteOnTransaction(bytes32 txHash, bool approve) external onlyActivePbftNode {
        PendingTransaction storage pendingTx = pendingTransactions[txHash];
        require(pendingTx.txHash != bytes32(0), "Transaction not found");
        require(!pendingTx.executed, "Transaction already executed");
        require(!pendingTx.consensusReached, "Consensus already reached");
        require(!pendingTx.hasVoted[msg.sender], "Already voted");
        require(block.timestamp <= pendingTx.proposalTime + consensusTimeoutSeconds, "Voting period expired");

        pendingTx.hasVoted[msg.sender] = true;
        pendingTx.voteValue[msg.sender] = approve;
        pendingTx.totalVotes++;

        if (approve) pendingTx.approveVotes++;
        else pendingTx.rejectVotes++;

        pbftNodes[msg.sender].votesParticipated++;

        emit ConsensusVote(txHash, msg.sender, approve);

        if (pendingTx.approveVotes >= pendingTx.requiredVotes) {
            pendingTx.consensusReached = true;
            _executeTransaction(txHash);
            emit ConsensusReached(txHash, true, pendingTx.approveVotes);
        } else if (pendingTx.rejectVotes >= pendingTx.requiredVotes) {
            pendingTx.consensusReached = true;
            emit ConsensusReached(txHash, false, pendingTx.rejectVotes);
        } else if (pendingTx.totalVotes == activeNodes.length) {
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

        usedClickHash[pendingTx.txHash] = true;
        Campaign storage c = campaigns[pendingTx.campaignId];
        c.budgetWei -= c.cpcWei;
        publisherBalance[pendingTx.publisher] += c.cpcWei;

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

    function cleanupExpiredTransaction(bytes32 txHash) external {
        PendingTransaction storage pendingTx = pendingTransactions[txHash];
        require(pendingTx.txHash != bytes32(0), "Transaction not found");
        require(!pendingTx.executed, "Transaction already executed");
        require(block.timestamp > pendingTx.proposalTime + consensusTimeoutSeconds, "Transaction not expired");

        if (!pendingTx.consensusReached) {
            pendingTx.consensusReached = true;
            emit ConsensusReached(txHash, false, pendingTx.approveVotes);
        }

        for (uint256 i = 0; i < pendingTxHashes.length; i++) {
            if (pendingTxHashes[i] == txHash) {
                pendingTxHashes[i] = pendingTxHashes[pendingTxHashes.length - 1];
                pendingTxHashes.pop();
                break;
            }
        }
    }

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

    function submitClickGatewayDirect(
        bytes32 clickHash,
        uint256 campaignId,
        address publisher,
        uint256 timestamp,
        bytes32 metadataCIDHash
    ) external onlyGateway {
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
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", rawHash));
        address recovered = recoverSigner(ethSigned, signature);
        require(recovered == gateway, "Invalid signature");
        require(isGateway[gateway], "Signer not gateway");

        if (timestamp > block.timestamp) {
            require(timestamp - block.timestamp <= maxClickFutureSeconds, "Timestamp too far in future");
        } else {
            require(block.timestamp - timestamp <= maxClickAgeSeconds, "Timestamp too old");
        }

        proposeTransaction(clickHash, campaignId, publisher, timestamp, metadataCIDHash);
    }

    function withdrawPublisher(uint256 amount) external {
        uint256 balance = publisherBalance[msg.sender];
        require(amount > 0 && amount <= balance, "Invalid amount");
        publisherBalance[msg.sender] = balance - amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit PublisherWithdrawal(msg.sender, amount);
    }

    // Views
    function getCampaign(uint256 campaignId)
        external
        view
        returns (address advertiser, uint256 cpcWei, uint256 budgetWei, bool paused, string memory meta)
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
        returns (bool isActive, uint256 stake, uint256 votesParticipated, uint256 correctVotes, uint256 accuracyPercentage)
    {
        PBFTNode storage pbftNode = pbftNodes[node];
        uint256 accuracy = 0;
        if (pbftNode.votesParticipated > 0) {
            accuracy = (pbftNode.correctVotes * 100) / pbftNode.votesParticipated;
        }
        return (pbftNode.isActive, pbftNode.stake, pbftNode.votesParticipated, pbftNode.correctVotes, accuracy);
    }

    receive() external payable {}
    fallback() external payable {}
}
