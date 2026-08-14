import { planAutoAllocations, splitAmountLargestRemainder } from './billing.utils';

describe('splitAmountLargestRemainder', () => {
  it('chia hết thì mọi người bằng nhau', () => {
    expect(splitAmountLargestRemainder(400_000, 4)).toEqual([100_000, 100_000, 100_000, 100_000]);
  });

  it('có dư thì n người đầu tiên chịu thêm đúng 1 đồng', () => {
    expect(splitAmountLargestRemainder(100_000, 3)).toEqual([33_334, 33_333, 33_333]);
  });

  it('một người thì gánh trọn', () => {
    expect(splitAmountLargestRemainder(123_457, 1)).toEqual([123_457]);
  });

  it('tổng bằng 0 vẫn ra đủ số dòng', () => {
    expect(splitAmountLargestRemainder(0, 3)).toEqual([0, 0, 0]);
  });

  it('không có người thì không có dòng nào', () => {
    expect(splitAmountLargestRemainder(100_000, 0)).toEqual([]);
  });

  // Bất biến quan trọng nhất của cả luồng chia tiền: không đồng nào được rơi vãi hay đẻ thêm.
  it.each([
    [100_000, 3],
    [123_457, 7],
    [1, 5],
    [999_999, 13],
    [250_000, 4],
    [7, 7],
    [0, 9],
  ])('SUM(kết quả) === total với total=%i, n=%i', (total, count) => {
    const parts = splitAmountLargestRemainder(total, count);
    expect(parts).toHaveLength(count);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
  });

  it('chênh lệch giữa người trả nhiều nhất và ít nhất không quá 1 đồng', () => {
    const parts = splitAmountLargestRemainder(100_000, 7);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });
});

describe('planAutoAllocations', () => {
  const debts = [
    { settlementId: 'cũ-nhất', remaining: 50_000 },
    { settlementId: 'giữa', remaining: 30_000 },
    { settlementId: 'mới-nhất', remaining: 20_000 },
  ];

  it('đủ tiền thì trả hết mọi khoản', () => {
    expect(planAutoAllocations(100_000, debts)).toEqual([
      { settlementId: 'cũ-nhất', amount: 50_000 },
      { settlementId: 'giữa', amount: 30_000 },
      { settlementId: 'mới-nhất', amount: 20_000 },
    ]);
  });

  it('thiếu tiền thì đổ đầy nợ cũ trước rồi dừng giữa chừng', () => {
    expect(planAutoAllocations(60_000, debts)).toEqual([
      { settlementId: 'cũ-nhất', amount: 50_000 },
      { settlementId: 'giữa', amount: 10_000 },
    ]);
  });

  it('thừa tiền thì phần thừa KHÔNG được phân bổ — caller phải chặn bằng PAY_003', () => {
    const plans = planAutoAllocations(200_000, debts);
    expect(plans.reduce((sum, plan) => sum + plan.amount, 0)).toBe(100_000);
  });

  it('không còn nợ nào thì không phân bổ gì', () => {
    expect(planAutoAllocations(50_000, [])).toEqual([]);
  });

  it('bỏ qua khoản đã trả đủ', () => {
    expect(planAutoAllocations(10_000, [{ settlementId: 'đã-trả', remaining: 0 }, ...debts])).toEqual([
      { settlementId: 'cũ-nhất', amount: 10_000 },
    ]);
  });
});
