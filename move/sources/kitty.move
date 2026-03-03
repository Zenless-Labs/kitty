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

    // === Status codes ===
    // 0 = pending
    // 1 = SUI paid
    // 2 = PayPal paid
    // 3 = alt coin paid (USDC or any other)

    // === Objects ===

    /// KittyEvent<T> — T is the alt coin type (e.g. USDC, or any memecoin).
    /// Frontend defaults T to USDC but any Sui coin type works.
    public struct KittyEvent<phantom T> has key {
        id: UID,
        organizer: address,
        title_encrypted: vector<u8>,
        encrypted_participants: vector<u8>,
        password_hash: vector<u8>,
        statuses: VecMap<String, u8>,
        pool_sui: Balance<SUI>,
        pool_coin: Balance<T>,  // generic alt coin pool
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

    public entry fun create_event<T>(
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

        let kitty_event = KittyEvent<T> {
            id: object::new(ctx),
            organizer: ctx.sender(),
            title_encrypted,
            encrypted_participants,
            password_hash,
            statuses,
            pool_sui: balance::zero<SUI>(),
            pool_coin: balance::zero<T>(),
            tip: balance::zero<SUI>(),
            goal_usd_cents,
            deadline,
            active: true,
        };

        event::emit(KittyEventCreated {
            event_id: object::id(&kitty_event),
            organizer: ctx.sender(),
            goal_usd_cents,
            deadline,
        });

        transfer::share_object(kitty_event);
    }

    /// Contribute SUI.
    public entry fun contribute_sui<T>(
        kitty_event: &mut KittyEvent<T>,
        name: String,
        payment: Coin<SUI>,
        _ctx: &mut TxContext,
    ) {
        assert!(kitty_event.active, EEventClosed);
        assert!(kitty_event.statuses.contains(&name), ENameNotFound);
        assert!(*kitty_event.statuses.get(&name) == 0, EAlreadyContributed);
        *kitty_event.statuses.get_mut(&name) = 1u8;
        kitty_event.pool_sui.join(coin::into_balance(payment));
    }

    /// Contribute SUI + tip.
    public entry fun contribute_sui_with_tip<T>(
        kitty_event: &mut KittyEvent<T>,
        name: String,
        payment: Coin<SUI>,
        tip_coin: Coin<SUI>,
        _ctx: &mut TxContext,
    ) {
        assert!(kitty_event.active, EEventClosed);
        assert!(kitty_event.statuses.contains(&name), ENameNotFound);
        assert!(*kitty_event.statuses.get(&name) == 0, EAlreadyContributed);
        *kitty_event.statuses.get_mut(&name) = 1u8;
        kitty_event.pool_sui.join(coin::into_balance(payment));
        kitty_event.tip.join(coin::into_balance(tip_coin));
    }

    /// Contribute alt coin (USDC or any T).
    public entry fun contribute_coin<T>(
        kitty_event: &mut KittyEvent<T>,
        name: String,
        payment: Coin<T>,
        _ctx: &mut TxContext,
    ) {
        assert!(kitty_event.active, EEventClosed);
        assert!(kitty_event.statuses.contains(&name), ENameNotFound);
        assert!(*kitty_event.statuses.get(&name) == 0, EAlreadyContributed);
        *kitty_event.statuses.get_mut(&name) = 3u8;
        kitty_event.pool_coin.join(coin::into_balance(payment));
    }

    /// Organizer marks a participant as paid via PayPal.
    public entry fun mark_paypal<T>(
        kitty_event: &mut KittyEvent<T>,
        name: String,
        ctx: &mut TxContext,
    ) {
        assert!(kitty_event.organizer == ctx.sender(), ENotOrganizer);
        assert!(kitty_event.active, EEventClosed);
        assert!(kitty_event.statuses.contains(&name), ENameNotFound);
        assert!(*kitty_event.statuses.get(&name) == 0, EAlreadyContributed);
        *kitty_event.statuses.get_mut(&name) = 2u8;
    }

    /// Organizer marks multiple participants as paid via PayPal in one tx.
    public entry fun mark_paypal_batch<T>(
        kitty_event: &mut KittyEvent<T>,
        names: vector<String>,
        ctx: &mut TxContext,
    ) {
        assert!(kitty_event.organizer == ctx.sender(), ENotOrganizer);
        assert!(kitty_event.active, EEventClosed);
        let mut i = 0;
        while (i < names.length()) {
            let name = names[i];
            if (kitty_event.statuses.contains(&name) && *kitty_event.statuses.get(&name) == 0) {
                *kitty_event.statuses.get_mut(&name) = 2u8;
            };
            i = i + 1;
        };
    }

    /// Organizer withdraws SUI pool + alt coin pool + tips.
    public entry fun organizer_withdraw<T>(
        kitty_event: &mut KittyEvent<T>,
        ctx: &mut TxContext,
    ) {
        assert!(kitty_event.organizer == ctx.sender(), ENotOrganizer);

        let sui_amount = kitty_event.pool_sui.value();
        if (sui_amount > 0) {
            let coin = coin::from_balance(kitty_event.pool_sui.split(sui_amount), ctx);
            transfer::public_transfer(coin, ctx.sender());
        };

        let coin_amount = kitty_event.pool_coin.value();
        if (coin_amount > 0) {
            let coin = coin::from_balance(kitty_event.pool_coin.split(coin_amount), ctx);
            transfer::public_transfer(coin, ctx.sender());
        };

        let tip_amount = kitty_event.tip.value();
        if (tip_amount > 0) {
            let coin = coin::from_balance(kitty_event.tip.split(tip_amount), ctx);
            transfer::public_transfer(coin, ctx.sender());
        };

        // Auto-close if all paid
        let n = kitty_event.statuses.size();
        let mut all_paid = true;
        let mut idx = 0;
        while (idx < n) {
            let (_, v) = kitty_event.statuses.get_entry_by_idx(idx);
            if (*v == 0u8) { all_paid = false; break };
            idx = idx + 1;
        };
        if (all_paid) { kitty_event.active = false; };
    }

    /// Anyone can add a SUI tip to cover organizer tx fees.
    public entry fun add_tip<T>(
        kitty_event: &mut KittyEvent<T>,
        tip: Coin<SUI>,
        _ctx: &mut TxContext,
    ) {
        assert!(kitty_event.active, EEventClosed);
        kitty_event.tip.join(coin::into_balance(tip));
    }

    /// Organizer closes the event.
    public entry fun close_event<T>(
        kitty_event: &mut KittyEvent<T>,
        ctx: &mut TxContext,
    ) {
        assert!(kitty_event.organizer == ctx.sender(), ENotOrganizer);
        kitty_event.active = false;
    }
}
