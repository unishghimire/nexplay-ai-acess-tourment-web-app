-- ═════════════════════════════════════════════════════════════════════════════
-- NEXPLAY ESPORTS PLATFORM — PRODUCTION POSTGRESQL RELATIONAL SCHEMA
-- ═════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension if supported
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(128) PRIMARY KEY,
    auth_id VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'organizer', 'admin')),
    in_game_id VARCHAR(64),
    in_game_name VARCHAR(100),
    phone VARCHAR(32),
    bio TEXT,
    profile_pic_url TEXT,
    banner_url TEXT,
    team_id VARCHAR(128),
    team_name VARCHAR(100),
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- 2. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(128) PRIMARY KEY,
    owner_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_name VARCHAR(150) NOT NULL,
    organization_identifier VARCHAR(100) UNIQUE NOT NULL,
    bio TEXT,
    contact_info VARCHAR(255),
    whatsapp VARCHAR(64),
    discord VARCHAR(255),
    youtube_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orgs_owner ON organizations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_orgs_identifier ON organizations(organization_identifier);

-- 3. TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tag VARCHAR(16),
    owner_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    logo_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disbanded', 'banned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

-- 4. TEAM MEMBERS TABLE
CREATE TABLE IF NOT EXISTS team_members (
    id VARCHAR(128) PRIMARY KEY,
    team_id VARCHAR(128) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'member' CHECK (role IN ('captain', 'co-captain', 'member', 'substitute')),
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- 5. TOURNAMENTS TABLE
CREATE TABLE IF NOT EXISTS tournaments (
    id VARCHAR(128) PRIMARY KEY,
    organization_id VARCHAR(128),
    host_uid VARCHAR(128) NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    game VARCHAR(100) NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'Battle Royale' CHECK (type IN ('Battle Royale', 'Clash Squad', 'BR', 'CS', '1v1', '5v5')),
    match_type VARCHAR(32) NOT NULL DEFAULT 'tournament' CHECK (match_type IN ('tournament', 'scrims')),
    tournament_mode VARCHAR(32) NOT NULL DEFAULT 'POINTS' CHECK (tournament_mode IN ('POINTS', 'PER_KILL_REWARD')),
    format VARCHAR(64) NOT NULL DEFAULT 'single_elimination',
    team_type VARCHAR(32) NOT NULL DEFAULT 'squad' CHECK (team_type IN ('solo', 'duo', 'squad')),
    team_size INT NOT NULL DEFAULT 4 CHECK (team_size BETWEEN 1 AND 10),
    entry_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (entry_fee >= 0),
    prize_pool NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (prize_pool >= 0),
    currency VARCHAR(16) NOT NULL DEFAULT 'NPR',
    slots INT NOT NULL DEFAULT 12 CHECK (slots >= 2),
    filled_slots INT NOT NULL DEFAULT 0 CHECK (filled_slots >= 0 AND filled_slots <= slots),
    current_players INT NOT NULL DEFAULT 0 CHECK (current_players >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('draft', 'pending_funding', 'upcoming', 'published', 'open', 'full', 'live', 'completed', 'cancelled')),
    funding_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (funding_status IN ('NOT_REQUIRED', 'PENDING_FUNDING', 'RESERVED', 'REFUNDED')),
    required_funding NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (required_funding >= 0),
    reserved_funding NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (reserved_funding >= 0),
    stage VARCHAR(64) NOT NULL DEFAULT 'registration' CHECK (stage IN ('registration', 'group_stage', 'knockout', 'completed', 'cancelled')),
    current_round INT NOT NULL DEFAULT 1 CHECK (current_round >= 1),
    map VARCHAR(100) DEFAULT 'Bermuda',
    banner_url TEXT,
    rules TEXT,
    scoring_snapshot JSONB,
    reward_snapshot JSONB,
    roadmap JSONB,
    prize_distribution JSONB,
    start_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournaments_host ON tournaments(host_uid);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_game ON tournaments(game);
CREATE INDEX IF NOT EXISTS idx_tournaments_match_type ON tournaments(match_type);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_time ON tournaments(start_time);

-- 6. TOURNAMENT REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id VARCHAR(128) PRIMARY KEY,
    tournament_id VARCHAR(128) NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id VARCHAR(128),
    team_name VARCHAR(100) NOT NULL,
    in_game_id VARCHAR(64),
    in_game_name VARCHAR(100),
    teammates JSONB,
    slot_number INT,
    status VARCHAR(32) NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'refunded', 'disqualified', 'withdrawn')),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tourn_user_reg UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON tournament_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON tournament_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_team ON tournament_registrations(team_id);

-- 7. ROUNDS TABLE
CREATE TABLE IF NOT EXISTS rounds (
    id VARCHAR(128) PRIMARY KEY,
    tournament_id VARCHAR(128) NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INT NOT NULL CHECK (round_number >= 1),
    stage_name VARCHAR(100) NOT NULL,
    qualification_rule INT NOT NULL DEFAULT 2 CHECK (qualification_rule >= 1),
    teams_per_group INT NOT NULL DEFAULT 12 CHECK (teams_per_group BETWEEN 2 AND 12),
    matches_per_group INT NOT NULL DEFAULT 3 CHECK (matches_per_group >= 1),
    status VARCHAR(32) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tourn_round UNIQUE (tournament_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_rounds_tournament ON rounds(tournament_id);

-- 8. GROUPS TABLE
CREATE TABLE IF NOT EXISTS groups (
    id VARCHAR(128) PRIMARY KEY,
    tournament_id VARCHAR(128) NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_id VARCHAR(128) NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    round_number INT NOT NULL DEFAULT 1,
    name VARCHAR(64) NOT NULL,
    team_limit INT NOT NULL DEFAULT 12 CHECK (team_limit BETWEEN 2 AND 12),
    status VARCHAR(32) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'locked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_groups_tournament ON groups(tournament_id);
CREATE INDEX IF NOT EXISTS idx_groups_round ON groups(round_id);

-- 9. GROUP MEMBERS TABLE (Enforces max 12 teams per group)
CREATE TABLE IF NOT EXISTS group_members (
    id VARCHAR(128) PRIMARY KEY,
    group_id VARCHAR(128) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    team_id VARCHAR(128) NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_group_team UNIQUE (group_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_team ON group_members(team_id);

-- 10. MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(128) PRIMARY KEY,
    tournament_id VARCHAR(128) NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    group_id VARCHAR(128) REFERENCES groups(id) ON DELETE CASCADE,
    round_number INT NOT NULL DEFAULT 1,
    match_number INT NOT NULL DEFAULT 1,
    map VARCHAR(100) DEFAULT 'Bermuda',
    scheduled_time TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed')),
    team1_id VARCHAR(128),
    team2_id VARCHAR(128),
    score1 INT NOT NULL DEFAULT 0,
    score2 INT NOT NULL DEFAULT 0,
    results JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_group ON matches(group_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- 11. WALLETS TABLE (Financial Authority)
CREATE TABLE IF NOT EXISTS wallets (
    id VARCHAR(128) PRIMARY KEY,
    owner_id VARCHAR(128) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    reserved_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (reserved_balance >= 0),
    org_wallet_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (org_wallet_balance >= 0),
    currency VARCHAR(16) NOT NULL DEFAULT 'NPR',
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallets_owner ON wallets(owner_id);

-- 12. WALLET TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id VARCHAR(128) PRIMARY KEY,
    wallet_id VARCHAR(128) NOT NULL REFERENCES wallets(id),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    type VARCHAR(64) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'tournament_reservation', 'tournament_release', 'prize_payout', 'tournament_entry', 'scrim_entry', 'refund', 'adjustment')),
    amount NUMERIC(14, 2) NOT NULL,
    method VARCHAR(100),
    ref_id VARCHAR(100),
    status VARCHAR(32) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'success', 'completed', 'rejected', 'refunded')),
    tournament_id VARCHAR(128),
    description TEXT,
    proof_url TEXT,
    balance_before NUMERIC(14, 2),
    balance_after NUMERIC(14, 2),
    confirmed_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON wallet_transactions(ref_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at);

-- 13. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    provider VARCHAR(64) NOT NULL CHECK (provider IN ('eSewa', 'Khalti', 'Bank Transfer', 'Manual')),
    reference_id VARCHAR(128) UNIQUE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- 14. PAYOUTS TABLE
CREATE TABLE IF NOT EXISTS payouts (
    id VARCHAR(128) PRIMARY KEY,
    tournament_id VARCHAR(128) NOT NULL REFERENCES tournaments(id),
    recipient_id VARCHAR(128) NOT NULL REFERENCES users(id),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    transaction_reference VARCHAR(128) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payouts_tournament ON payouts(tournament_id);
CREATE INDEX IF NOT EXISTS idx_payouts_recipient ON payouts(recipient_id);

-- 15. DISPUTES TABLE
CREATE TABLE IF NOT EXISTS disputes (
    id VARCHAR(128) PRIMARY KEY,
    tournament_id VARCHAR(128) NOT NULL REFERENCES tournaments(id),
    reporter_uid VARCHAR(128) NOT NULL REFERENCES users(id),
    organizer_id VARCHAR(128),
    match_room VARCHAR(64),
    reason TEXT NOT NULL,
    reported_team_id VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disputes_tournament ON disputes(tournament_id);
CREATE INDEX IF NOT EXISTS idx_disputes_reporter ON disputes(reporter_uid);

-- 16. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(128),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    tournament_id VARCHAR(128),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
