// BlockchainEventListener.js - FIXED VERSION
const { ethers } = require('ethers');
const fetch = require('node-fetch');

class BlockchainEventListener {
    constructor(rpcUrl, contractAddress, contractABI, adminServiceUrl) {
        this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        this.contract = new ethers.Contract(contractAddress, contractABI, this.provider);
        this.adminServiceUrl = adminServiceUrl;
        this.isListening = false;
    }

    async startListening() {
        if (this.isListening) return;
        
        console.log('🎧 Starting blockchain event listener...');
        this.isListening = true;

        // Listen for ConsensusReached events
        this.contract.on('ConsensusReached', async (txHash, approved, voteCount, event) => {
            console.log('📡 ConsensusReached event received:', {
                txHash,
                approved,
                voteCount: voteCount.toString(),
                blockNumber: event.blockNumber
            });

            if (approved) {
                console.log(`✅ PBFT Consensus reached for transaction: ${txHash}`);
                await this.handleConsensusReached(txHash, event);
            } else {
                console.log(`❌ PBFT Consensus rejected for transaction: ${txHash}`);
            }
        });

        // Listen for AdminSignatureRequired events (if using smart contract integration)
        this.contract.on('AdminSignatureRequired', async (txHash, campaignId, publisher, event) => {
            console.log(`🔐 Admin signature required for transaction: ${txHash}`);
            await this.handleAdminSignatureRequired(txHash, campaignId, publisher, event);
        });

        console.log('🎧 Event listeners active');
    }

    async handleConsensusReached(txHash, event) {
        try {
            console.log(`🔍 Fetching transaction details for: ${txHash}`);
            
            // Get transaction details from smart contract with proper error handling
            const txDetails = await this.contract.getPendingTransactionDetails(txHash);
            
            console.log('📋 Raw transaction details:', txDetails);

            // FIXED: Properly handle BigNumber conversion with null checks
            const safeToString = (value) => {
                if (value === null || value === undefined) {
                    return '0';
                }
                // Handle BigNumber objects
                if (value && value._isBigNumber) {
                    return value.toString();
                }
                // Handle regular numbers or strings
                return value.toString();
            };

            // FIXED: Handle the returned array properly - getPendingTransactionDetails returns an array
            const [
                campaignId,
                publisher, 
                gateway,
                approveVotes,
                rejectVotes,
                totalVotes,
                requiredVotes,
                executed,
                consensusReached,
                proposalTime
            ] = txDetails;

            console.log('📊 Parsed transaction details:', {
                campaignId: safeToString(campaignId),
                publisher,
                gateway,
                approveVotes: safeToString(approveVotes),
                totalVotes: safeToString(totalVotes),
                executed,
                consensusReached
            });

            // Prepare data for admin approval service
            const adminSubmissionData = {
                transactionId: txHash,
                clickHash: txHash, // Using txHash as clickHash
                campaignId: safeToString(campaignId),
                publisher: publisher,
                gateway: gateway,
                timestamp: safeToString(proposalTime),
                metadataCIDHash: ethers.constants.HashZero, // Default value if not available
                pbftConsensus: {
                    approved: true,
                    approveVotes: safeToString(approveVotes),
                    totalVotes: safeToString(totalVotes),
                    requiredVotes: safeToString(requiredVotes),
                    consensusReached: consensusReached
                }
            };

            console.log('📤 Submitting to admin service:', adminSubmissionData);

            // Submit to admin approval service
            const response = await fetch(`${this.adminServiceUrl}/api/transactions/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(adminSubmissionData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Transaction submitted for admin approval:', result);
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to submit to admin service:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
            }

        } catch (error) {
            console.error('💥 Error handling consensus reached:', error);
            
            // Add detailed error information
            if (error.reason) {
                console.error('🔍 Error reason:', error.reason);
            }
            if (error.code) {
                console.error('🔢 Error code:', error.code);
            }
            if (error.transaction) {
                console.error('📝 Transaction that caused error:', error.transaction);
            }
        }
    }

    async handleAdminSignatureRequired(txHash, campaignId, publisher, event) {
        // This could be used for additional logging or processing
        console.log(`📋 Admin signature required - TX: ${txHash}, Campaign: ${campaignId.toString()}, Publisher: ${publisher}`);
    }

    stopListening() {
        if (!this.isListening) return;
        
        console.log('🛑 Stopping blockchain event listener...');
        this.contract.removeAllListeners();
        this.isListening = false;
    }
}

module.exports = BlockchainEventListener;
