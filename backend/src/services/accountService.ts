import { db } from '../db/database.js';

export type Tier = 'starter' | 'growth' | 'enterprise';

export interface Account {
  name: string;
  plan: string;
  tier: Tier;
  credits: { used: number; total: number };
  // Feature gating derived from the tier.
  features: {
    emailSequences: boolean;
    teamManagement: boolean;
    unlimitedScouts: boolean;
  };
}

interface AccountRow {
  name: string;
  plan: string;
  tier: Tier;
  credits_used: number;
  credits_total: number;
}

function featuresForTier(tier: Tier): Account['features'] {
  return {
    emailSequences: tier === 'growth' || tier === 'enterprise',
    teamManagement: tier === 'enterprise',
    unlimitedScouts: tier !== 'starter',
  };
}

export const accountService = {
  get(): Account {
    const row = db.prepare('SELECT * FROM account WHERE id = 1').get() as AccountRow;
    return {
      name: row.name,
      plan: row.plan,
      tier: row.tier,
      credits: { used: row.credits_used, total: row.credits_total },
      features: featuresForTier(row.tier),
    };
  },

  /** Spend credits for a metered action. Returns false if insufficient balance. */
  spend(amount: number): boolean {
    const row = db.prepare('SELECT credits_used, credits_total FROM account WHERE id = 1').get() as {
      credits_used: number;
      credits_total: number;
    };
    if (row.credits_used + amount > row.credits_total) return false;
    db.prepare('UPDATE account SET credits_used = credits_used + ? WHERE id = 1').run(amount);
    return true;
  },

  setTier(tier: Tier): Account {
    const totals: Record<Tier, number> = { starter: 500, growth: 5000, enterprise: 25000 };
    const plans: Record<Tier, string> = {
      starter: 'Starter',
      growth: 'Growth',
      enterprise: 'Enterprise',
    };
    db.prepare('UPDATE account SET tier = ?, plan = ?, credits_total = ? WHERE id = 1').run(
      tier,
      plans[tier],
      totals[tier]
    );
    return this.get();
  },
};
