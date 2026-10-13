/* Template Method: skeleton shared by every handler that changes the status of a transaction or a delivery */

/**
 * Abstract handler. The method handle() is the template method: it fixes the order of the steps, while
 * the subclasses define what each step does.
 */
class StatusChangeHandler {
	/**
	 * Status that the handler sets (abstract): 'cancelled', 'completed', or 'pending'.
	 */
	get targetStatus() {
		throw new Error('targetStatus must be implemented by the subclass');
	}

	/**
	 * Template method: updates the status, propagates the change, and responds to the client.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 * @return {Promise<void>} Resolves when the response has been sent.
	 */
	async handle(req, res) {
		await this.updateStatus(req);
		await this.propagate(req, res);
		this.respond(res);
	}

	/**
	 * Updates the status of the entity (abstract step).
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 */
	updateStatus(req) {
		throw new Error('updateStatus must be implemented by the subclass');
	}

	/**
	 * Propagates the change to the related entities (abstract step).
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	propagate(req, res) {
		throw new Error('propagate must be implemented by the subclass');
	}

	/**
	 * Responds to the client (concrete step shared by all handlers).
	 *
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	respond(res) {
		res.status(200).json('Delivery status updated successfully!');
		res.send();
	}
}

module.exports = StatusChangeHandler;
