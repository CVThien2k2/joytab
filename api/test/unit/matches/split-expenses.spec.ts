import { ratioFor, splitExpenses } from '../../../src/matches/matches.utils';

describe('splitExpenses', () => {
  const female = (id: string) => ({ userId: id, gender: 'female' as const });
  const male = (id: string) => ({ userId: id, gender: 'male' as const });

  it('chia theo hệ số, để LẺ tới đồng, không làm tròn lên nghìn', () => {
    // 490.000đ, 2 nam + 2 nữ, hệ số 1.2 → 4,4 suất → một suất nữ = 111.363,63đ
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
    // Trước đây làm tròn lên nghìn ra [134.000, 134.000, 112.000, 112.000] và thu dư 2.000đ.
    expect(result.charges.map((charge) => charge.amount)).toEqual([133_636, 133_636, 111_364, 111_364]);
    // Thu đúng bằng chi, không còn đồng nào rơi vào quỹ.
    expect(result.surplus).toBe(0);
  });

  it('phần lẻ không chia hết được phát 1đ cho người có phần dư lớn nhất, tổng vẫn khớp', () => {
    // 10đ cho 4 nữ: mỗi người 2,5đ. Phần dư bằng nhau nên hai người đầu danh sách nhận thêm 1đ.
    const result = splitExpenses({
      participants: [female('a'), female('b'), female('c'), female('d')],
      expenses: [{ quantity: 1, unitPrice: 10 }],
      maleRatio: 1.2,
    });

    expect(result.charges.map((charge) => charge.amount)).toEqual([3, 3, 2, 2]);
    expect(result.charges.reduce((sum, charge) => sum + charge.amount, 0)).toBe(result.total);
    expect(result.surplus).toBe(0);
  });

  it('chia hết thì mọi người bằng nhau', () => {
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

  it('hệ số lẻ hai chữ số thập phân: số tiền KHÔNG còn là bội của nghìn', () => {
    const result = splitExpenses({
      participants: [male('a'), female('b'), female('c')],
      expenses: [{ quantity: 3, unitPrice: 111_111 }],
      maleRatio: 1.33,
    });

    expect(result.total).toBe(333_333);
    expect(result.charges.map((charge) => charge.amount)).toEqual([133_133, 100_100, 100_100]);
    expect(result.charges.some((charge) => charge.amount % 1_000 !== 0)).toBe(true);
    expect(result.charges.reduce((sum, charge) => sum + charge.amount, 0)).toBe(result.total);
    expect(result.surplus).toBe(0);
  });
});
