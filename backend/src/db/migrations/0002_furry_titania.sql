ALTER TABLE "bookings" ADD COLUMN "rental_days" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "delivery_fee_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "security_deposit_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "security_deposit_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_classes" ADD COLUMN "chauffeur_day_rate_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_classes" ADD COLUMN "security_deposit_pesewas" integer DEFAULT 0 NOT NULL;