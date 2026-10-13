/* State: o status atual da transação decide qual estratégia de estoque aplicar ao mudar de status.
 *
 * Substitui os ifs dos handlers postEditStatus* de controllers/transaction-controller.js:
 *   pending|completed -> cancelled      : devolve estoque   (ReturnStrategy)
 *   cancelled -> pending|completed      : consome estoque   (ConsumeStrategy)
 *   demais transições (e status nulo)   : nada              (NoStockChange)
 */
const {ConsumeStrategy, ReturnStrategy, NoStockChange} = require('./stock-strategies.js');

class TransactionState {
	/* Por padrão, nenhuma transição mexe no estoque. */
	strategyFor(nextStatus) {
		return NoStockChange;
	}

	/* Devolve o estado correspondente ao status. Status desconhecido ou ausente vira o estado nulo.
	 * O original compara com ==, então um valor que se converte na string do status (ex.: um array
	 * vindo do corpo da requisição) também casa; String() reproduz essa conversão.
	 */
	static of(status) {
		const key = status === undefined || status === null ? status : String(status);
		return STATES.has(key) ? STATES.get(key) : UNKNOWN_STATE;
	}
}

class PendingState extends TransactionState {
	strategyFor(nextStatus) {
		return nextStatus === 'cancelled' ? ReturnStrategy : NoStockChange;
	}
}

class CompletedState extends TransactionState {
	strategyFor(nextStatus) {
		return nextStatus === 'cancelled' ? ReturnStrategy : NoStockChange;
	}
}

class CancelledState extends TransactionState {
	strategyFor(nextStatus) {
		return nextStatus === 'pending' || nextStatus === 'completed' ? ConsumeStrategy : NoStockChange;
	}
}

/* Null Object para status desconhecido ou indefinido: herda o comportamento padrão. */
class UnknownState extends TransactionState {}

const UNKNOWN_STATE = Object.freeze(new UnknownState());

const STATES = new Map([
	['pending', Object.freeze(new PendingState())],
	['completed', Object.freeze(new CompletedState())],
	['cancelled', Object.freeze(new CancelledState())]
]);

module.exports = {
	TransactionState: TransactionState,
	PendingState: PendingState,
	CompletedState: CompletedState,
	CancelledState: CancelledState,
	UnknownState: UnknownState
};
