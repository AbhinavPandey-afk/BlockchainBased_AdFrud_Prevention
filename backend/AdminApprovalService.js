// AdminApprovalService.js - Enhanced with debug logging
const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');

class AdminApprovalService {
    constructor() {
        this.app = express();
        this.pendingTransactions = new Map();
        this.adminSigners = new Set();
        this.nonces = new Map();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Add request logging
        this.app.use((req, res, next) => {
            console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        this.app.post('/api/transactions/submit', (req, res) => this.submitForApproval(req, res));
        this.app.get('/api/transactions/pending', (req, res) => this.getPendingTransactions(req, res));
        this.app.post('/api/transactions/approve', (req, res) => this.approveTransaction(req, res));
        this.app.post('/api/transactions/execute', (req, res) => this.executeTransaction(req, res));
        this.app.get('/api/transactions/:id/status', (req, res) => this.getTransactionStatus(req, res));
        this.app.get('/api/admin/nonce/:address', (req, res) => this.getAdminNonce(req, res));
        
        // Add debug endpoint to check admin configuration
        this.app.get('/api/admin/config', (req, res) => this.getAdminConfig(req, res));
    }

    // NEW: Debug endpoint to check admin configuration
    async getAdminConfig(req, res) {
        res.json({
            success: true,
            adminSigners: Array.from(this.adminSigners),
            adminSignerCount: this.adminSigners.size,
            pendingTransactionCount: this.pendingTransactions.size
        });
    }

    async submitForApproval(req, res) {
        try {
            const { 
                transactionId, 
                clickHash, 
                campaignId, 
                publisher, 
                gateway,
                timestamp,
                metadataCIDHash,
                pbftConsensus 
            } = req.body;

            console.log('📥 Transaction submission received:', {
                transactionId,
                campaignId,
                publisher
            });

            if (!pbftConsensus || !pbftConsensus.approved) {
                return res.status(400).json({ error: 'PBFT consensus required' });
            }

            const pendingTransaction = {
                id: transactionId,
                clickHash,
                campaignId,
                publisher,
                gateway,
                timestamp,
                metadataCIDHash,
                pbftConsensus,
                status: 'PENDING_ADMIN_APPROVAL',
                submittedAt: new Date().toISOString(),
                adminApproval: null,
                adminSigner: null
            };

            this.pendingTransactions.set(transactionId, pendingTransaction);

            console.log('✅ Transaction stored for admin approval:', transactionId);

            res.json({
                success: true,
                message: 'Transaction submitted for admin approval',
                transactionId,
                status: 'PENDING_ADMIN_APPROVAL'
            });

            this.notifyAdmin(pendingTransaction);

        } catch (error) {
            console.error('Submit for approval error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getPendingTransactions(req, res) {
        try {
            const pending = Array.from(this.pendingTransactions.values())
                .filter(tx => tx.status === 'PENDING_ADMIN_APPROVAL')
                .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

            console.log(`📋 Returning ${pending.length} pending transactions`);

            res.json({
                success: true,
                transactions: pending,
                count: pending.length
            });
        } catch (error) {
            console.error('Get pending transactions error:', error);
            res.status(500).json({ error: 'Failed to fetch transactions' });
        }
    }

    async approveTransaction(req, res) {
        try {
            const { 
                transactionId, 
                adminSignature, 
                adminAddress,
                decision
            } = req.body;

            console.log('🔍 Admin approval request received:');
            console.log(`   📧 Admin address: ${adminAddress}`);
            console.log(`   🆔 Transaction ID: ${transactionId}`);
            console.log(`   📋 Decision: ${decision}`);
            console.log(`   🔐 Configured admins: [${Array.from(this.adminSigners).join(', ')}]`);

            // Normalize addresses for comparison (both to lowercase)
            const normalizedAdminAddress = adminAddress.toLowerCase();
            const normalizedAdminSigners = Array.from(this.adminSigners).map(addr => addr.toLowerCase());

            console.log(`   🔍 Normalized admin address: ${normalizedAdminAddress}`);
            console.log(`   🔍 Normalized configured admins: [${normalizedAdminSigners.join(', ')}]`);

            // Check if admin is authorized (case-insensitive)
            const isAuthorized = normalizedAdminSigners.includes(normalizedAdminAddress);
            
            if (!isAuthorized) {
                console.log('❌ 403 Forbidden: Admin not authorized');
                return res.status(403).json({ 
                    error: 'Unauthorized admin',
                    providedAddress: adminAddress,
                    configuredAddresses: Array.from(this.adminSigners),
                    hint: 'Make sure your MetaMask address matches the configured admin address'
                });
            }

            console.log('✅ Admin authorization confirmed');

            const transaction = this.pendingTransactions.get(transactionId);
            if (!transaction) {
                console.log('❌ Transaction not found:', transactionId);
                return res.status(404).json({ error: 'Transaction not found' });
            }

            if (transaction.status !== 'PENDING_ADMIN_APPROVAL') {
                console.log('❌ Transaction not pending approval:', transaction.status);
                return res.status(400).json({ error: 'Transaction not pending approval' });
            }

            // Verify admin signature
            const messageHash = this.createAdminMessageHash(transactionId, adminAddress);
            const isValidSignature = await this.verifyAdminSignature(
                messageHash, 
                adminSignature, 
                adminAddress
            );

            if (!isValidSignature) {
                console.log('❌ Invalid admin signature');
                return res.status(400).json({ error: 'Invalid admin signature' });
            }

            console.log('✅ Admin signature verified');

            // Update transaction with admin decision
            transaction.adminApproval = decision;
            transaction.adminSigner = adminAddress;
            transaction.adminSignature = adminSignature;
            transaction.status = decision === 'approve' ? 'ADMIN_APPROVED' : 'ADMIN_REJECTED';
            transaction.approvedAt = new Date().toISOString();

            // Increment nonce to prevent replay
            const currentNonce = this.nonces.get(normalizedAdminAddress) || 0;
            this.nonces.set(normalizedAdminAddress, currentNonce + 1);

            console.log(`✅ Transaction ${decision}d successfully by admin`);

            res.json({
                success: true,
                message: `Transaction ${decision}d by admin`,
                transactionId,
                status: transaction.status
            });

            // If approved, trigger execution
            if (decision === 'approve') {
                console.log('🚀 Triggering auto-execution...');
                setTimeout(() => this.triggerExecution(transactionId), 1000);
            }

        } catch (error) {
            console.error('Approve transaction error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async executeTransaction(req, res) {
        try {
            const { transactionId } = req.body;
            console.log('🚀 Executing transaction:', transactionId);
            
            const transaction = this.pendingTransactions.get(transactionId);
            if (!transaction || transaction.status !== 'ADMIN_APPROVED') {
                return res.status(400).json({ error: 'Transaction not approved' });
            }

            // For now, just mark as executed (you can implement blockchain submission later)
            transaction.status = 'EXECUTED';
            transaction.executedAt = new Date().toISOString();

            console.log('✅ Transaction executed successfully:', transactionId);

            res.json({
                success: true,
                message: 'Transaction executed successfully',
                transactionId
            });

        } catch (error) {
            console.error('Execute transaction error:', error);
            res.status(500).json({ error: 'Execution failed' });
        }
    }

    async getTransactionStatus(req, res) {
        try {
            const { id } = req.params;
            const transaction = this.pendingTransactions.get(id);
            
            if (!transaction) {
                return res.status(404).json({ error: 'Transaction not found' });
            }

            res.json({
                success: true,
                transaction: {
                    id: transaction.id,
                    status: transaction.status,
                    submittedAt: transaction.submittedAt,
                    adminSigner: transaction.adminSigner,
                    approvedAt: transaction.approvedAt,
                    executedAt: transaction.executedAt
                }
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get status' });
        }
    }

    async getAdminNonce(req, res) {
        try {
            const { address } = req.params;
            const normalizedAddress = address.toLowerCase();
            const nonce = this.nonces.get(normalizedAddress) || 0;
            
            console.log(`📊 Nonce requested for ${address}: ${nonce}`);
            
            res.json({
                success: true,
                address,
                nonce
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get nonce' });
        }
    }

    createAdminMessageHash(transactionId, adminAddress) {
        const normalizedAddress = adminAddress.toLowerCase();
        const nonce = this.nonces.get(normalizedAddress) || 0;
        return ethers.utils.solidityKeccak256(
            ['string', 'string', 'address', 'uint256'],
            ['ADMIN_APPROVAL_V1', transactionId, adminAddress, nonce]
        );
    }

    async verifyAdminSignature(messageHash, signature, expectedSigner) {
        try {
            const recoveredSigner = ethers.utils.verifyMessage(
                ethers.utils.arrayify(messageHash), 
                signature
            );
            return recoveredSigner.toLowerCase() === expectedSigner.toLowerCase();
        } catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    }

    notifyAdmin(transaction) {
        console.log(`🔔 New transaction awaiting admin approval: ${transaction.id}`);
        console.log(`   📧 Admin address: 0xab03E52FA4aE3F82f67e16810659479C494552bE`);
        console.log(`   🌐 Dashboard: http://localhost:3000/admin`);
    }

    async triggerExecution(transactionId) {
        try {
            await this.executeTransaction(
                { body: { transactionId } }, 
                {
                    json: (data) => console.log('Auto-execution result:', data),
                    status: (code) => ({ json: (data) => data })
                }
            );
        } catch (error) {
            console.error('Auto-execution failed:', error);
        }
    }

    start(port = 3001) {
        this.app.listen(port, () => {
            console.log(`🚀 Admin Approval Service running on port ${port}`);
            console.log(`📋 API Endpoints:`);
            console.log(`   GET  /api/transactions/pending`);
            console.log(`   POST /api/transactions/approve`);
            console.log(`   GET  /api/admin/config`);
            console.log(`🔐 Admin Address: 0xab03E52FA4aE3F82f67e16810659479C494552bE`);
            console.log(`📊 Admin signers configured: ${this.adminSigners.size}`);
        });
    }
}

module.exports = AdminApprovalService;
