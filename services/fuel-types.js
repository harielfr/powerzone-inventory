/* Registro dos combustíveis vendidos pelo posto.
 *
 * Cada entrada liga o tipo do lote no inventário (Inventory.type) ao campo de litros da transação
 * (Transaction.liters*). Substitui as cinco cópias de arrays e ifs por combustível que existiam
 * nos handlers de mudança de status de controllers/transaction-controller.js.
 */
const FUEL_TYPES = Object.freeze([
	Object.freeze({key: 'gasoline', inventoryType: 'gasoline', litersField: 'litersGasoline'}),
	Object.freeze({key: 'premium-gasoline-95', inventoryType: 'premium-gasoline-95', litersField: 'litersPremiumGasoline95'}),
	Object.freeze({key: 'diesel', inventoryType: 'diesel', litersField: 'litersDiesel'}),
	Object.freeze({key: 'premium-gasoline-97', inventoryType: 'premium-gasoline-97', litersField: 'litersPremiumGasoline97'}),
	Object.freeze({key: 'kerosene', inventoryType: 'kerosene', litersField: 'litersKerosene'})
]);

/* No código original, um lote de tipo desconhecido cai no else e é tratado como querosene. */
const FALLBACK_FUEL_KEY = 'kerosene';

/* Separa os lotes por combustível, preservando a ordem de entrada dentro de cada grupo.
 * Devolve {key: [lotes]} com uma entrada (possivelmente vazia) para cada combustível.
 * Os lotes não são copiados: as estratégias mutam os mesmos objetos que serão gravados.
 */
function groupStocksByFuel(stocks) {
	const groups = {};
	const keyByType = {};

	FUEL_TYPES.forEach(function(fuel) {
		groups[fuel.key] = [];
		keyByType[fuel.inventoryType] = fuel.key;
	});

	stocks.forEach(function(stock) {
		const key = Object.prototype.hasOwnProperty.call(keyByType, stock.type) ?
			keyByType[stock.type] :
			FALLBACK_FUEL_KEY;
		groups[key].push(stock);
	});

	return groups;
}

module.exports = {
	FUEL_TYPES: FUEL_TYPES,
	FALLBACK_FUEL_KEY: FALLBACK_FUEL_KEY,
	groupStocksByFuel: groupStocksByFuel
};
