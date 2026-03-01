module kitty::kitty {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::vec_map::{Self, VecMap};
    use sui::event;
    use std::string::String;

    // === Errors ===
    const ENotOrganizer: u64 = 0;
    const EEventClosed: u64 = 1;
    const ENameNotFound: u64 = 2;
    const EAlreadyContributed: u64 = 3;

    // === Objects ===

    /// The crowdfund event — shared object, accessible to anyone with the ID.
    /// Participant list is AES-256-GCM encrypted client-side; only people
    /// with the password can see who's contributing.
    public struct KittyEvent has key {
        id: UID,
        organizer: address,
        title_encrypted: vector<u8>,         // encrypted event title
        encrypted_participants: vector<u8>,  // encrypted JSON blob of names
        password_hash: vector<u8>,           // sha-256 of password (client-side)
        statuses: VecMap<String, u8>,        // name -> 0=pending, 1=sui, 2=paypal
        pool: Balance<SUI>,
        tip: Balance<SUI>,
        goal_usd_cents: u64,  // goal in USD cents (e.g. $100.00 = 10000)
        deadline: u64,        // unix timestamp ms, 0 = no deadline
        active: bool,
    }

    // === Emitted Events (for indexing) ===

    public struct KittyEventCreated has copy, drop {
        event_id: ID,
        organizer: address,
        goal_usd_cents: u64,
        deadline: u64,
    }

    // === Functions ===

    /// Anyone can create a crowdfund event.
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
            pool: balance::zero<SUI>(),
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
        crowdfund_event.pool.join(coin::into_balance(payment));
    }

    /// Contribute SUI + optional tip to cover organizer gas fees.
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
        crowdfund_event.pool.join(coin::into_balance(payment));
        crowdfund_event.tip.join(coin::into_balance(tip_coin));
    }

    /// Organizer marks a participant as paid via Paypal.
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

    /// Organizer withdraws pool + tips.
    public entry fun organizer_withdraw(
        crowdfund_event: &mut KittyEvent,
        ctx: &mut TxContext,
    ) {
        assert!(crowdfund_event.organizer == ctx.sender(), ENotOrganizer);
        let pool_amount = crowdfund_event.pool.value();
        if (pool_amount > 0) {
            let pool_coin = coin::from_balance(crowdfund_event.pool.split(pool_amount), ctx);
            transfer::public_transfer(pool_coin, ctx.sender());
        };
        let tip_amount = crowdfund_event.tip.value();
        if (tip_amount > 0) {
            let tip_coin = coin::from_balance(crowdfund_event.tip.split(tip_amount), ctx);
            transfer::public_transfer(tip_coin, ctx.sender());
        };
    }


    /// Organizer marks multiple participants as paid via Paypal in one tx.
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

    /// Organizer closes the event — no more contributions accepted.
    public entry fun close_event(
        crowdfund_event: &mut KittyEvent,
        ctx: &mut TxContext,
    ) {
        assert!(crowdfund_event.organizer == ctx.sender(), ENotOrganizer);
        crowdfund_event.active = false;
    }
}
