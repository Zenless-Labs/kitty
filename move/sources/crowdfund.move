module sui_crowdfund::crowdfund {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::vec_map::{Self, VecMap};
    use std::string::String;

    // === Errors ===
    const ENotOrganizer: u64 = 0;
    const EEventClosed: u64 = 1;
    const ENameNotFound: u64 = 2;
    const EAlreadyContributed: u64 = 3;

    // === Structs ===
    public struct AdminCap has key, store {
        id: UID,
    }

    public struct CreatorCap has key, store {
        id: UID,
    }

    public struct Event has key {
        id: UID,
        organizer: address,
        encrypted_participants: vector<u8>,
        password_hash: vector<u8>,
        statuses: VecMap<String, u8>,
        pool: Balance<SUI>,
        tip: Balance<SUI>,
        goal: u64,
        deadline: u64,
        active: bool,
    }

    // === Init ===
    fun init(ctx: &mut TxContext) {
        transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    }

    // === Admin Functions ===
    public fun admin_add_creator(
        _cap: &AdminCap,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        transfer::transfer(CreatorCap { id: object::new(ctx) }, recipient);
    }

    // === Creator Functions ===
    public fun create_event(
        _cap: &CreatorCap,
        encrypted_participants: vector<u8>,
        password_hash: vector<u8>,
        names: vector<String>,
        goal: u64,
        deadline: u64,
        ctx: &mut TxContext,
    ) {
        let mut statuses = vec_map::empty<String, u8>();
        let mut i = 0;
        while (i < names.length()) {
            statuses.insert(names[i], 0);
            i = i + 1;
        };

        let event = Event {
            id: object::new(ctx),
            organizer: ctx.sender(),
            encrypted_participants,
            password_hash,
            statuses,
            pool: balance::zero<SUI>(),
            tip: balance::zero<SUI>(),
            goal,
            deadline,
            active: true,
        };
        transfer::share_object(event);
    }

    // === Contributor Functions ===
    public fun contribute_sui(
        event: &mut Event,
        name: String,
        payment: Coin<SUI>,
        _ctx: &mut TxContext,
    ) {
        assert!(event.active, EEventClosed);
        assert!(event.statuses.contains(&name), ENameNotFound);
        assert!(*event.statuses.get(&name) == 0, EAlreadyContributed);
        *event.statuses.get_mut(&name) = 1;
        event.pool.join(coin::into_balance(payment));
    }

    public fun contribute_sui_with_tip(
        event: &mut Event,
        name: String,
        payment: Coin<SUI>,
        tip_coin: Coin<SUI>,
        _ctx: &mut TxContext,
    ) {
        assert!(event.active, EEventClosed);
        assert!(event.statuses.contains(&name), ENameNotFound);
        assert!(*event.statuses.get(&name) == 0, EAlreadyContributed);
        *event.statuses.get_mut(&name) = 1;
        event.pool.join(coin::into_balance(payment));
        event.tip.join(coin::into_balance(tip_coin));
    }

    public fun mark_paypal(
        event: &mut Event,
        name: String,
        _ctx: &mut TxContext,
    ) {
        assert!(event.active, EEventClosed);
        assert!(event.statuses.contains(&name), ENameNotFound);
        assert!(*event.statuses.get(&name) == 0, EAlreadyContributed);
        *event.statuses.get_mut(&name) = 2;
    }

    // === Organizer Functions ===
    public fun organizer_withdraw(
        event: &mut Event,
        ctx: &mut TxContext,
    ) {
        assert!(event.organizer == ctx.sender(), ENotOrganizer);
        let pool_amount = event.pool.value();
        if (pool_amount > 0) {
            let pool_coin = coin::from_balance(event.pool.split(pool_amount), ctx);
            transfer::public_transfer(pool_coin, ctx.sender());
        };
        let tip_amount = event.tip.value();
        if (tip_amount > 0) {
            let tip_coin = coin::from_balance(event.tip.split(tip_amount), ctx);
            transfer::public_transfer(tip_coin, ctx.sender());
        };
    }

    public fun close_event(
        event: &mut Event,
        ctx: &mut TxContext,
    ) {
        assert!(event.organizer == ctx.sender(), ENotOrganizer);
        event.active = false;
    }
}
