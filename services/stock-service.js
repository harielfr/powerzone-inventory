/* Fachada usada pelos handlers de mudança de status (lado do Victor).
 *
 * Liga State e Strategy: o estado do status antigo escolhe a estratégia para o novo status, que é
 * aplicada a cada combustível da transação. O inventário só é lido e gravado quando a estratégia
 * não é a vazia, como no original (que nem consultava o inventário nas transições sem efeito).
 */
const {FUEL_TYPES, groupStocksByFuel} = require('./fuel-types.js');
const {NoStockChange} = require('./stock-strategies.js');
const {TransactionState} = require('./transaction-state.js');

const StockService = {
	/* transaction: documento com os campos liters* (ver services/fuel-types.js).
	 * inventoryRepo: {findAll(): Promise<lotes>, saveDepleted(lotes)}.
	 * A gravação é dispara-e-esquece (não é aguardada), como os updateOneIterative do original.
	 */
	adjust: async function({transaction, oldStatus, newStatus}, inventoryRepo) {
		const strategy = TransactionState.of(oldStatus).strategyFor(newStatus);

		if (strategy === NoStockChange) {
			return;
		}

		const stocks = await inventoryRepo.findAll();
		const groups = groupStocksByFuel(stocks);

		FUEL_TYPES.forEach(function(fuel) {
			const liters = transaction[fuel.litersField];

			if (liters > 0) {
				strategy.apply(groups[fuel.key], liters);
			}
		});

		/* Grava todos os lotes, mesmo os que não mudaram, agrupados por combustível como no original. */
		const allStocks = [];
		FUEL_TYPES.forEach(function(fuel) {
			Array.prototype.push.apply(allStocks, groups[fuel.key]);
		});

		inventoryRepo.saveDepleted(allStocks);
	}
};

module.exports = StockService;
