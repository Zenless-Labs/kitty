module kitty::kitty {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::vec_map::{Self, VecMap};
    use sui::event;
    use std::string::String;

    // USDC on Sui mainnet
    // 0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
    public struct USDC has drop {}

    // === Errors ===
    const ENotOrganizer: u64 = 0;
    const EEventClosed: u64 = 1;
    const ENameNotFound: u64 = 2;
    const EAlreadyContributed: u64 = 3;

    // === Status codes ===
    // 0 = pending
    // 1 = SUI paid
    // 2 = PayPal paid
    // 3 = USDC paid

    // === Objects ===

    public struct KittyEvent has key {
        id: UID,
        organizer: address,
        title_encrypted: vector<u8>,
        encrypted_participants: vector<u8>,
        password_hash: vector<u8>,
        statuses: VecMap<String, u8>,
        pool_sui: Balance<SUI>,
        pool_usdc: Balance<0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC>,
        tip: Balance<SUI>,
        goal_usd_cents: u64,
        deadline: u64,
        active: bool,
    }

    // === Events ===

    public struct KittyEventCreated has copy, drop {
        event_id: ID,
        organizer: address,
        goal_usd_cents: u64,
        deadline: u64,
    }

    // === Functions ===

    public entry fun create_event(
        title_encrypted: vector<u8>,
        encrypted_participants: vector<u8>,
        password_hash: vector<u8>,
        names: vector<String>,
        goal_usd_cents: u64,
        deadline: u64,
        ctx: &mut TxContext,
    ) {
        let mut statuses = vec_map::empty<String, u8>();
        let mut i = 0;
        while (i < names.length()) {
            statuses.insert(names[i], 0u8);
            i = i + 1;
        };

        let crowdfund_event = KittyEvent {
            id: object::new(ctx),
            organizer: ctx.sender(),
            title_encrypted,
            encrypted_participants,
            password_hash,
            statuses,
            pool_sui: balance::zero<SUI>(),
            pool_usdc: balance::zero<0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC>(),
            tip: balance::zero<SUI>(),
            goal_usd_cents,
            deadline,
            active: true,
        };

        event::emit(KittyEventCreated {
            event_id: object::id(&crowdfund_event),
            organizer: ctx.sender(),
            goal_usd_cents,
            deadline,
        });

        transfer::share_object(crowdfund_event);
    }

    /// Contribute SUI to an event.
    public entry fun contribute_sui(
        crowdfund_event: &mut KittyEvent,
        name: String,
        payment: Coin<SUI>,
        _ctx: &mut TxContext,
    ) {
        assert!(crowdfund_event.active, EEventClosed);
        assert!(crowdfund_event.statuses.contains(&name), ENameNotFound);
        assert!(*crowdfund_event.statuses.get(&name) == 0, EAlreadyContributed);
        *crowdfund_event.statuses.get_mut(&name) = 1u8;
        crowdfund_event.pool_sui.join(coin::into_balance(payment));
    }

    /// Contribute SUI + optional tip.
    public entry fun contribute_sui_with_tip(
        crowdfund_event: &mut KittyEvent,
        name: String,
        payment: Coin<SUI>,
        tip_coin: Coin<SUI>,
        _ctx: &mut TxContext,
    ) {
        assert!(crowdfund_event.active, EEventClosed);
        assert!(crowdfund_event.statuses.contains(&name), ENameNotFound);
        assert!(*crowdfund_event.statuses.get(&name) == 0, EAlreadyContributed);
        *crowdfund_event.statuses.get_mut(&name) = 1u8;
        crowdfund_event.pool_sui.join(coin::into_balance(payment));
        crowdfund_event.tip.join(coin::into_balance(tip_coin));
    }

    /// Contribute USDC to an event.
    public entry fun contribute_usdc(
        crowdfund_event: &mut KittyEvent,
        name: String,
        payment: Coin<0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC>,
        _ctx: &mut TxContext,
    ) {
        assert!(crowdfund_event.active, EEventClosed);
        assert!(crowdfund_event.statuses.contains(&name), ENameNotFound);
        assert!(*crowdfund_event.statuses.get(&name) == 0, EAlreadyContributed);
        *crowdfund_event.statuses.get_mut(&name) = 3u8;
        crowdfund_event.pool_usdc.join(coin::into_balance(payment));
    }

    /// Organizer marks a participant as paid via PayPal.
    public entry fun mark_paypal(
        crowdfund_event: &mut KittyEvent,
        name: String,
        ctx: &mut TxContext,
    ) {
        assert!(crowdfund_event.organizer == ctx.sender(), ENotOrganizer);
        assert!(crowdfund_event.active, EEventClosed);
        assert!(crowdfund_event.statuses.contains(&name), ENameNotFound);
        assert!(*crowdfund_event.statuses.get(&name) == 0, EAlreadyContributed);
        *crowdfund_event.statuses.get_mut(&name) = 2u8;
    }

    /// Organizer marks multiple participants as paid via PayPal in one tx.
    public entry fun mark_paypal_batch(
        crowdfund_event: &mut KittyEvent,
        names: vector<String>,
        ctx: &mut TxContext,
    ) {
        assert!(crowdfund_event.organizer == ctx.sender(), ENotOrganizer);
        assert!(crowdfund_event.active, EEventClosed);
        let mut i = 0;
        while (i < names.length()) {
            let name = names[i];
            if (crowdfund_event.statuses.contains(&name) && *crowdfund_event.statuses.get(&name) == 0) {
                *crowdfund_event.statuses.get_mut(&name) = 2u8;
            };
            i = i + 1;
        };
    }

    /// Organizer withdraws pool (SUI + USDC) + tips.
    public entry fun organizer_withdraw(
        crowdfund_event: &mut KittyEvent,
        ctx: &mut TxContext,
    ) {
        assert!(crowdfund_event.organizer == ctx.sender(), ENotOrganizer);

        let pool_sui_amount = crowdfund_event.pool_sui.value();
        if (pool_sui_amount > 0) {
            let coin = coin::from_balance(crowdfund_event.pool_sui.split(pool_sui_amount), ctx);
            transfer::public_transfer(coin, ctx.sender());
        };

        let pool_usdc_amount = crowdfund_event.pool_usdc.value();
        if (pool_usdc_amount > 0) {
            let coin = coin::from_balance(crowdfund_event.pool_usdc.split(pool_usdc_amount), ctx);
            transfer::public_transfer(coin, ctx.sender());
        };

        let tip_amount = crowdfund_event.tip.value();
        if (tip_amount > 0) {
            let coin = coin::from_balance(crowdfund_event.tip.split(tip_amount), ctx);
            transfer::public_transfer(coin, ctx.sender());
        };

        // Auto-close if all participants have contributed
        let n = crowdfund_event.statuses.size();
        let mut all_paid = true;
        let mut idx = 0;
        while (idx < n) {
            let (_, v) = crowdfund_event.statuses.get_entry_by_idx(idx);
            if (*v == 0u8) { all_paid = false; break };
            idx = idx + 1;
        };
        if (all_paid) { crowdfund_event.active = false; };
    }

    /// Organizer closes the event.
    public entry fun close_event(
        crowdfund_event: &mut KittyEvent,
        ctx: &mut TxContext,
    ) {
        assert!(crowdfund_event.organizer == ctx.sender(), ENotOrganizer);
        crowdfund_event.active = false;
    }
}
