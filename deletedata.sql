TRUNCATE TABLE
    cart,
    detail_ordering,
    ordering,
    transaction,
    fish,
    weight,
    seller,
    consumer
RESTART IDENTITY CASCADE;

VACUUM FULL ANALYZE;