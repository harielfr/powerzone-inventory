/* Handlers that change the status of a delivery (and of its transaction) */
const StatusChangeHandler = require('./status-change-handler.js');
const {
	CancelledTransactionHandler,
	CompletedTransactionHandler,
	PendingTransactionHandler
} = require('./transaction-status-handlers.js');
const TransactionRepository = require('../repositories/transaction-repository.js');
const DeliveryRepository = require('../repositories/delivery-repository.js');
const ids = require('../repositories/ids.js');

/**
 * Base handler for the delivery statuses. Subclasses define the target status and the transaction handler
 * to which the change is delegated.
 */
class DeliveryStatusHandler extends StatusChangeHandler {
	/**
	 * @param {Object} dependencies  Collaborators; each one defaults to the real implementation.
	 * @param {DeliveryRepository} dependencies.deliveryRepo  Repository of deliveries.
	 * @param {TransactionRepository} dependencies.transactionRepo  Repository of transactions.
	 * @param {StatusChangeHandler} dependencies.transactionHandler  Handler to which the change is delegated.
	 */
	constructor({deliveryRepo, transactionRepo, transactionHandler} = {}) {
		super();
		this.deliveryRepo = deliveryRepo || new DeliveryRepository();
		this.transactionRepo = transactionRepo || new TransactionRepository();
		this.transactionHandler = transactionHandler || this.createTransactionHandler();
	}

	/**
	 * Creates the transaction handler of the same status (abstract step).
	 */
	createTransactionHandler() {
		throw new Error('createTransactionHandler must be implemented by the subclass');
	}

	/**
	 * Updates the status of the selected delivery.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @return {Promise<boolean>} Resolves when the status has been updated.
	 */
	updateStatus(req) {
		return this.deliveryRepo.updateStatus(req.body.deliveryId, this.targetStatus);
	}

	/**
	 * Retrieves the transaction of the delivery and delegates the status change to the transaction handler.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 * @return {Promise<void>} Resolves when the transaction handler has responded.
	 */
	async propagate(req, res) {
		const transactionId = ids.deliveryToTransaction(req.body.deliveryId);
		const result = await this.transactionRepo.findById(transactionId, 'id status');

		/* Assign the retrieved transaction details to the body of the request object. */
		req.body.transactionId = result.id;
		req.body.transactionStatusOld = result.status;

		await this.transactionHandler.handle(req, res);
	}

	/**
	 * Does nothing: the response is sent by the transaction handler to which the change was delegated.
	 */
	respond() {}
}

/**
 * Sets the status of a delivery to "Cancelled".
 */
class CancelledDeliveryHandler extends DeliveryStatusHandler {
	/**
	 * @return {string} 'cancelled'.
	 */
	get targetStatus() {
		return 'cancelled';
	}

	/**
	 * @return {StatusChangeHandler} Handler of the cancelled transaction status.
	 */
	createTransactionHandler() {
		return new CancelledTransactionHandler();
	}
}

/**
 * Sets the status of a delivery to "Completed".
 */
class CompletedDeliveryHandler extends DeliveryStatusHandler {
	/**
	 * @return {string} 'completed'.
	 */
	get targetStatus() {
		return 'completed';
	}

	/**
	 * @return {StatusChangeHandler} Handler of the completed transaction status.
	 */
	createTransactionHandler() {
		return new CompletedTransactionHandler();
	}
}

/**
 * Sets the status of a delivery to "Pending".
 */
class PendingDeliveryHandler extends DeliveryStatusHandler {
	/**
	 * @return {string} 'pending'.
	 */
	get targetStatus() {
		return 'pending';
	}

	/**
	 * @return {StatusChangeHandler} Handler of the pending transaction status.
	 */
	createTransactionHandler() {
		return new PendingTransactionHandler();
	}
}

module.exports = {
	DeliveryStatusHandler,
	CancelledDeliveryHandler,
	CompletedDeliveryHandler,
	PendingDeliveryHandler
};
