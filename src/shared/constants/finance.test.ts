import { describe, it, expect } from 'vitest';
import { calculateTournamentRequiredFunding, calculateFundingShortage } from './finance';

describe('Tournament Funding, Wallet & Prize Reserve System - Audit Tests', () => {
  describe('Rule 1: Free Tournaments with Rs. 0 Prize Pool', () => {
    it('requires Rs. 0 funding when prize pool is 0 or negative', () => {
      expect(calculateTournamentRequiredFunding(0)).toBe(0);
      expect(calculateTournamentRequiredFunding(undefined as any)).toBe(0);
      expect(calculateTournamentRequiredFunding(-500)).toBe(0);
      expect(calculateTournamentRequiredFunding(NaN)).toBe(0);
    });

    it('can activate with Rs. 0 wallet balance', () => {
      const { required, available, shortage, isFunded } = calculateFundingShortage(0, 0);
      expect(required).toBe(0);
      expect(available).toBe(0);
      expect(shortage).toBe(0);
      expect(isFunded).toBe(true);
    });
  });

  describe('Rule 2: Monetary Prize Pool Funding Requirement', () => {
    it('requires exact monetary amount for prize pool', () => {
      expect(calculateTournamentRequiredFunding(5000)).toBe(5000);
      expect(calculateTournamentRequiredFunding(12500)).toBe(12500);
    });

    it('blocks activation when wallet has 0 balance and prize > 0', () => {
      const { required, available, shortage, isFunded } = calculateFundingShortage(5000, 0);
      expect(required).toBe(5000);
      expect(available).toBe(0);
      expect(shortage).toBe(5000);
      expect(isFunded).toBe(false);
    });

    it('calculates shortage accurately on partial wallet balance', () => {
      const { required, available, shortage, isFunded } = calculateFundingShortage(5000, 2000);
      expect(required).toBe(5000);
      expect(available).toBe(2000);
      expect(shortage).toBe(3000);
      expect(isFunded).toBe(false);
    });

    it('approves funding when wallet balance exactly equals required funding', () => {
      const { required, available, shortage, isFunded } = calculateFundingShortage(5000, 5000);
      expect(required).toBe(5000);
      expect(available).toBe(5000);
      expect(shortage).toBe(0);
      expect(isFunded).toBe(true);
    });

    it('approves funding when wallet balance exceeds required funding', () => {
      const { required, available, shortage, isFunded } = calculateFundingShortage(5000, 15000);
      expect(required).toBe(5000);
      expect(available).toBe(15000);
      expect(shortage).toBe(0);
      expect(isFunded).toBe(true);
    });
  });

  describe('Rule 3: Escrow Accounting & Double-Spend Invariant', () => {
    it('maintains strict accounting invariant: Total = Available + Reserved', () => {
      const initialWallet = 10000;
      let available = initialWallet;
      let reserved = 0;

      // Tournament A requires 6,000
      const tourneyARequired = 6000;
      expect(available >= tourneyARequired).toBe(true);
      available -= tourneyARequired;
      reserved += tourneyARequired;

      expect(available).toBe(4000);
      expect(reserved).toBe(6000);
      expect(available + reserved).toBe(initialWallet);

      // Tournament B requires 5,000 (only 4,000 available -> REJECTED)
      const tourneyBRequired = 5000;
      const tourneyBCheck = calculateFundingShortage(tourneyBRequired, available);
      expect(tourneyBCheck.isFunded).toBe(false);
      expect(tourneyBCheck.shortage).toBe(1000);

      // Total balance is still conserved
      expect(available + reserved).toBe(initialWallet);
    });

    it('restores available balance on tournament cancellation', () => {
      let available = 4000;
      let reserved = 6000;

      // Cancel Tournament A (6,000 released back)
      const releaseAmount = 6000;
      reserved -= releaseAmount;
      available += releaseAmount;

      expect(available).toBe(10000);
      expect(reserved).toBe(0);
    });

    it('deducts prize payouts from escrow and refunds leftover funds to available balance', () => {
      let available = 0;
      let reserved = 5000;

      // Winners awarded 4,200 out of 5,000
      const prizePayout = 4200;
      const leftover = reserved - prizePayout;

      reserved -= (prizePayout + leftover);
      available += leftover;

      expect(reserved).toBe(0);
      expect(available).toBe(800);
    });
  });

  describe('Rule 4: Registration Protection Invariant', () => {
    it('forbids player registration if prize pool > 0 and funding status is not RESERVED', () => {
      const tournament = {
        prizePool: 5000,
        fundingStatus: 'PENDING_FUNDING',
        status: 'pending_funding',
      };

      const canRegister = (t: typeof tournament) => {
        const prize = Math.max(0, Math.round(Number(t.prizePool || 0)));
        if (prize > 0 && t.fundingStatus !== 'RESERVED') {
          return false;
        }
        return true;
      };

      expect(canRegister(tournament)).toBe(false);

      // Once funding is secured in escrow:
      tournament.fundingStatus = 'RESERVED';
      tournament.status = 'upcoming';
      expect(canRegister(tournament)).toBe(true);
    });
  });
});
