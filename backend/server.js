// server.js - Updated with your admin address
require('dotenv').config();
const AdminApprovalService = require('./AdminApprovalService');
const BlockchainEventListener = require('./BlockchainEventListener');

// Contract ABI - You'll need to import your actual contract ABI
const CONTRACT_ABI = [
    "event ConsensusReached(bytes32 indexed txHash, bool approved, uint256 voteCount)",
    "event AdminSignatureRequired(bytes32 indexed txHash, uint256 indexed campaignId, address indexed publisher)",
    "function getPendingTransactionDetails(bytes32 txHash) view returns (uint256 campaignId, address publisher, address gateway, uint256 approveVotes, uint256 rejectVotes, uint256 totalVotes, uint256 requiredVotes, bool executed, bool consensusReached, uint256 proposalTime)"
];

async function main() {
    // Initialize admin approval service
    const adminService = new AdminApprovalService();
    
    // Add your ACTUAL admin address
    adminService.adminSigners.add('0xab03E52FA4aE3F82f67e16810659479C494552bE'); // Your admin address
    
    // Add additional admin addresses if needed (optional)
    if (process.env.ADDITIONAL_ADMIN_ADDRESS) {
        adminService.adminSigners.add(process.env.ADDITIONAL_ADMIN_ADDRESS);
    }
    
    console.log('✅ Configured admin signers:');
    adminService.adminSigners.forEach(address => {
        console.log(`   📧 ${address}`);
    });
    
    // Start admin approval service
    adminService.start(3001);

    // Initialize blockchain event listener (if contract address is available)
    if (process.env.CONTRACT_ADDRESS) {
        const eventListener = new BlockchainEventListener(
            process.env.RPC_URL || 'http://127.0.0.1:7545',
            process.env.CONTRACT_ADDRESS,
            CONTRACT_ABI,
            'http://localhost:3001' // Admin service URL
        );

        // Start listening to blockchain events
        await eventListener.startListening();
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('🛑 Shutting down services...');
            eventListener.stopListening();
            process.exit(0);
        });
        
        console.log('🎧 Blockchain Event Listener: Active');
    } else {
        console.log('⚠️  CONTRACT_ADDRESS not set, skipping blockchain event listener');
    }

    console.log('🚀 All services started successfully!');
    console.log('📋 Admin Approval Service: http://localhost:3001');
    console.log(`🔐 Admin Address: 0xab03E52FA4aE3F82f67e16810659479C494552bE`);
}

main().catch(console.error);
