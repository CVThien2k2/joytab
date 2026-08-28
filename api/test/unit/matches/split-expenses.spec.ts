import { ratioFor, splitExpenses } from '../../../src/matches/matches.utils';

describe('splitExpenses', () => {
  const female = (id: string) => ({ userId: id, gender: 'female' as const });
  const male = (id: string) => ({ userId: id, gender: 'male' as const });

  it('chia theo hệ số và làm tròn LÊN nghìn, phần dư vào quỹ', () => {
    // 490.000đ, 2 nam + 2 nữ, hệ số 1.2 → 4.4 suất → một suất nữ = 111.363,6đ
    const result = splitExpenses({
      participants: [male('a'), male('b'), female('c'), female('d')],
      expenses: [
        { quantity: 2, unitPrice: 120_000 },
        { quantity: 6, unitPrice: 25_000 },
        { quantity: 10, unitPrice: 10_000 },
      ],
      maleRatio: 1.2,
    });

    expect(result.total).toBe(490_000);
    expect(result.charges.map((charge) => charge.amount)).toEqual([134_000, 134_000, 112_000, 112_000]);
    // Thu 492.000 cho khoản chi 490.000 — dư đúng 2.000, không âm.
    expect(result.surplus).toBe(2_000);
  });

  it('chia hết thì không dư', () => {
    const result = splitExpenses({
      participants: [female('a'), female('b'), female('c'), female('d')],
      expenses: [{ quantity: 1, unitPrice: 400_000 }],
      maleRatio: 1.2,
    });

    expect(result.charges.every((charge) => charge.amount === 100_000)).toBe(true);
    expect(result.surplus).toBe(0);
  });

  it('other và chưa khai giới tính tính như nam', () => {
    expect(ratioFor('other', 1.5)).toBe(1.5);
    expect(ratioFor(null, 1.5)).toBe(1.5);
    expect(ratioFor('female', 1.5)).toBe(1);
  });

  it('tổng chi bằng 0 thì mọi người trả 0, không chia cho 0', () => {
    const result = splitExpenses({
      participants: [male('a'), female('b')],
      expenses: [],
      maleRatio: 1.2,
    });

    expect(result.total).toBe(0);
    expect(result.charges.map((charge) => charge.amount)).toEqual([0, 0]);
    expect(result.surplus).toBe(0);
  });

  it('không có ai tham gia thì không có khoản nào', () => {
    const result = splitExpenses({
      participants: [],
      expenses: [{ quantity: 1, unitPrice: 100_000 }],
      maleRatio: 1.2,
    });

    expect(result.charges).toEqual([]);
    expect(result.surplus).toBe(0);
  });

  it('hệ số lẻ hai chữ số thập phân vẫn ra số nguyên nghìn', () => {
    const result = splitExpenses({
      participants: [male('a'), female('b'), female('c')],
      expenses: [{ quantity: 3, unitPrice: 111_111 }],
      maleRatio: 1.33,
    });

    expect(result.charges.every((charge) => charge.amount % 1_000 === 0)).toBe(true);
    const collected = result.charges.reduce((sum, charge) => sum + charge.amount, 0);
    expect(collected - result.total).toBe(result.surplus);
    expect(result.surplus).toBeGreaterThanOrEqual(0);
  });
});
