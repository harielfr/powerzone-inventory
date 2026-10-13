/* Handlers that change the status of a transaction (and of its delivery) */
const StatusChangeHandler = require('./status-change-handler.js');
const InventoryRepository = require('../repositories/inventory-repository.js');
const TransactionRepository = require('../repositories/transaction-repository.js');
const DeliveryRepository = require('../repositories/delivery-repository.js');
const ids = require('../repositories/ids.js');
const {TransactionState} = require('../services/transaction-state.js');
const {NoStockChange} = require('../services/stock-strategies.js');

/* Fields of the transaction needed to adjust the stocks. */
const STOCK_PROJECTION = 'id litersGasoline litersPremiumGasoline95 litersDiesel litersPremiumGasoline97 litersKerosene';

/**
 * Base handler for the transaction statuses. Subclasses only define the target status.
 */
class TransactionStatusHandler extends StatusChangeHandler {
	/**
	 * @param {Object} dependencies  Collaborators; each one defaults to the real implementation.
	 * @param {TransactionRepository} dependencies.transactionRepo  Repository of transactions.
	 * @param {DeliveryRepository} dependencies.deliveryRepo  Repository of deliveries.
	 * @param {InventoryRepository} dependencies.inventoryRepo  Repository of inventory stocks.
	 * @param {Object} dependencies.stockService  Service with adjust({transaction, oldStatus, newStatus}, inventoryRepo).
	 */
	constructor({transactionRepo, deliveryRepo, inventoryRepo, stockService} = {}) {
		super();
		this.transactionRepo = transactionRepo || new TransactionRepository();
		this.deliveryRepo = deliveryRepo || new DeliveryRepository();
		this.inventoryRepo = inventoryRepo || new InventoryRepository();
		this.customStockService = stockService;
	}

	/**
	 * Service that adjusts the stocks. The default one is loaded on first use.
	 *
	 * @return {Object} Service with adjust({transaction, oldStatus, newStatus}, inventoryRepo).
	 */
	get stockService() {
		return this.customStockService || require('../services/stock-service.js');
	}

	/**
	 * Updates the status of the selected transaction.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @return {Promise<boolean>} Resolves when the status has been updated.
	 */
	updateStatus(req) {
		return this.transactionRepo.updateStatus(req.body.transactionId, this.targetStatus);
	}

	/**
	 * Adjusts the stocks according to the status change (only when the change affects them), then updates the
	 * status of the delivery.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @return {Promise<boolean>} Resolves when the delivery has been updated.
	 */
	async propagate(req) {
		const transactionId = req.body.transactionId;
		const oldStatus = req.body.transactionStatusOld;

		/* As in the original code, the transaction is only read when the change affects the stocks. */
		if (TransactionState.of(oldStatus).strategyFor(this.targetStatus) !== NoStockChange) {
			const transaction = await this.transactionRepo.findById(transactionId, STOCK_PROJECTION);

			await this.stockService.adjust({
				transaction: transaction,
				oldStatus: oldStatus,
				newStatus: this.targetStatus
			}, this.inventoryRepo);
		}

		return this.deliveryRepo.updateStatus(ids.transactionToDelivery(transactionId), this.targetStatus);
	}
}

/**
 * Sets the status of a transaction to "Cancelled".
 */
class CancelledTransactionHandler extends TransactionStatusHandler {
	/**
	 * @return {string} 'cancelled'.
	 */
	get targetStatus() {
		return 'cancelled';
	}
}

/**
 * Sets the status of a transaction to "Completed".
 */
class CompletedTransactionHandler extends TransactionStatusHandler {
	/**
	 * @return {string} 'completed'.
	 */
	get targetStatus() {
		return 'completed';
	}
}

/**
 * Sets the status of a transaction to "Pending".
 */
class PendingTransactionHandler extends TransactionStatusHandler {
	/**
	 * @return {string} 'pending'.
	 */
	get targetStatus() {
		return 'pending';
	}
}

module.exports = {
	TransactionStatusHandler,
	CancelledTransactionHandler,
	CompletedTransactionHandler,
	PendingTransactionHandler
};
