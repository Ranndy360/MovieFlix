import { faker } from '@faker-js/faker';

import { defineFactory } from '../factory';
import type { AuthSession, AuthUser, Role } from '@/types/auth';

export const authUserFactory = defineFactory<AuthUser>(() => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    role: 'USER',
    isActive: true,
    lastLoginAt: faker.date.recent().toISOString(),
    createdAt: faker.date.past({ years: 1 }).toISOString(),
  };
});

export const buildUser = (role: Role = 'USER', overrides: Partial<AuthUser> = {}): AuthUser =>
  authUserFactory.build({ role, ...overrides });

export const buildAdmin = (overrides: Partial<AuthUser> = {}): AuthUser =>
  buildUser('ADMIN', overrides);

export const buildProvider = (overrides: Partial<AuthUser> = {}): AuthUser =>
  buildUser('PROVIDER', overrides);

export const buildSession = (user: AuthUser = buildUser()): AuthSession => ({
  user,
  expiresIn: 900,
});
