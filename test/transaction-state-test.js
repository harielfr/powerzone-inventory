const expect = require('chai').expect;

const {
	TransactionState,
	PendingState,
	CompletedState,
	CancelledState,
	UnknownState
} = require('../services/transaction-state.js');
const {ConsumeStrategy, ReturnStrategy, NoStockChange} = require('../services/stock-strategies.js');

describe('estados da transação (services/transaction-state.js)', function() {
	describe('TransactionState.of', function() {
		[
			{status: 'pending', type: PendingState},
			{status: 'completed', type: CompletedState},
			{status: 'cancelled', type: CancelledState},
			{status: undefined, type: UnknownState},
			{status: null, type: UnknownState},
			{status: 'Pending', type: UnknownState},
			{status: 'constructor', type: UnknownState},
			{status: ['cancelled'], type: CancelledState} // casa por ==, como no original
		].forEach(function(scenario) {
			it(JSON.stringify(scenario.status) + ' -> ' + scenario.type.name, function() {
				expect(TransactionState.of(scenario.status)).to.be.an.instanceof(scenario.type);
			});
		});

		it('devolve sempre a mesma instância para o mesmo status', function() {
			expect(TransactionState.of('pending')).to.equal(TransactionState.of('pending'));
			expect(TransactionState.of(undefined)).to.equal(TransactionState.of('xyz'));
		});
	});

	describe('strategyFor: tabela completa de transições', function() {
		const EXPECTED = {
			'pending': {pending: NoStockChange, completed: NoStockChange, cancelled: ReturnStrategy},
			'completed': {pending: NoStockChange, completed: NoStockChange, cancelled: ReturnStrategy},
			'cancelled': {pending: ConsumeStrategy, completed: ConsumeStrategy, cancelled: NoStockChange},
			'undefined': {pending: NoStockChange, completed: NoStockChange, cancelled: NoStockChange},
			'desconhecido': {pending: NoStockChange, completed: NoStockChange, cancelled: NoStockChange}
		};
		const OLD_STATUS = {
			'pending': 'pending',
			'completed': 'completed',
			'cancelled': 'cancelled',
			'undefined': undefined,
			'desconhecido': 'delivered'
		};
		const NAMES = new Map([
			[ConsumeStrategy, 'ConsumeStrategy'],
			[ReturnStrategy, 'ReturnStrategy'],
			[NoStockChange, 'NoStockChange']
		]);

		Object.keys(EXPECTED).forEach(function(oldLabel) {
			Object.keys(EXPECTED[oldLabel]).forEach(function(newStatus) {
				const expected = EXPECTED[oldLabel][newStatus];
				it(oldLabel + ' -> ' + newStatus + ': ' + NAMES.get(expected), function() {
					expect(TransactionState.of(OLD_STATUS[oldLabel]).strategyFor(newStatus)).to.equal(expected);
				});
			});
		});
	});
});
