CREATE INDEX idx_ordering_id_consumer ON ordering(id_consumer);
CREATE INDEX idx_ordering_status ON ordering(status);

CREATE INDEX idx_transaction_id_consumer ON transaction(id_consumer);
CREATE INDEX idx_transaction_id_ordering ON transaction(id_ordering);
CREATE INDEX idx_transaction_status ON transaction(status);

CREATE INDEX idx_detail_ordering_id_consumer ON detail_ordering(id_consumer);
CREATE INDEX idx_detail_ordering_id_ordering ON detail_ordering(id_ordering);
CREATE INDEX idx_detail_ordering_id_fish ON detail_ordering(id_fish);

CREATE INDEX idx_cart_id_consumer ON cart(id_consumer);
CREATE INDEX idx_cart_id_fish ON cart(id_fish);

CREATE INDEX idx_fish_id_seller ON fish(id_seller);
CREATE INDEX idx_fish_id_weight ON fish(id_weight);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_fish_name_trgm ON fish USING GIN (name gin_trgm_ops);

CREATE UNIQUE INDEX idx_consumer_email ON consumer(email);

CREATE UNIQUE INDEX idx_seller_email ON seller(email);