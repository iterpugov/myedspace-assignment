import type { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from './identity.service';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password';

// The real functions, with verifyPassword wrapped so its calls can be counted. A plain
// jest.spyOn does not work here: TypeScript's CommonJS exports cannot be redefined.
jest.mock('./password', () => {
  const actual: typeof import('./password') = jest.requireActual('./password');
  return { ...actual, verifyPassword: jest.fn(actual.verifyPassword) };
});

/** Obviously fake; never a real credential. */
const FAKE_PASSWORD = 'not-a-real-password';
const STUDENT_ID = '3f0c1a52-8f1e-4c57-9d0b-6c2f6f0f4a11';

interface StudentRow {
  id: string;
  username: string;
  firstName: string;
  passwordHash: string;
  createdAt: Date;
}

interface StudentQuery {
  where: { username?: string; id?: string };
  select?: Partial<Record<keyof StudentRow, boolean>>;
}

/** Stands in for Prisma: one student table, read by username or id, honouring `select`. */
function fakePrisma(rows: StudentRow[]): PrismaService {
  const find = ({ where, select }: StudentQuery): Promise<Partial<StudentRow> | null> => {
    const row = rows.find(
      (candidate) =>
        (where.username !== undefined && candidate.username === where.username) ||
        (where.id !== undefined && candidate.id === where.id),
    );
    if (!row) return Promise.resolve(null);
    if (!select) return Promise.resolve({ ...row });
    const picked = Object.fromEntries(Object.entries(row).filter(([key]) => select[key as keyof StudentRow] === true));
    return Promise.resolve(picked);
  };
  return { student: { findUnique: jest.fn(find), findFirst: jest.fn(find) } } as unknown as PrismaService;
}

describe('IdentityService.authenticate (LMS-1, ADR 026)', () => {
  const verify = jest.mocked(verifyPassword);
  let storedHash: string;
  let identity: IdentityService;

  beforeAll(async () => {
    storedHash = await hashPassword(FAKE_PASSWORD);
  });

  beforeEach(() => {
    const rows: StudentRow[] = [
      { id: STUDENT_ID, username: 'sam', firstName: 'Sam', passwordHash: storedHash, createdAt: new Date() },
    ];
    identity = new IdentityService(fakePrisma(rows));
    verify.mockClear();
  });

  it('returns undefined for an unknown username and still verifies exactly once, against the dummy hash', async () => {
    const result = await identity.authenticate('nobody', FAKE_PASSWORD);

    expect(result).toBeUndefined();
    expect(verify).toHaveBeenCalledTimes(1);
    const dummy = await dummyPasswordHash();
    expect(dummy).not.toBe(storedHash);
    expect(verify).toHaveBeenCalledWith(FAKE_PASSWORD, dummy);
  });

  it('verifies exactly once, against the stored hash, for a known username', async () => {
    const wrong = await identity.authenticate('sam', `${FAKE_PASSWORD}x`);

    expect(wrong).toBeUndefined();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(`${FAKE_PASSWORD}x`, storedHash);

    verify.mockClear();
    const right = await identity.authenticate('sam', FAKE_PASSWORD);

    expect(right).toBeDefined();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(FAKE_PASSWORD, storedHash);
  });

  it('returns a student with exactly id, username and firstName — no passwordHash', async () => {
    const student = await identity.authenticate('sam', FAKE_PASSWORD);

    expect(student).toEqual({ id: STUDENT_ID, username: 'sam', firstName: 'Sam' });
    expect(Object.keys(student ?? {}).sort()).toEqual(['firstName', 'id', 'username']);
    expect(JSON.stringify(student)).not.toContain(storedHash);
  });
});
