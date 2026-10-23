CREATE TABLE `balls` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`needs_push` integer DEFAULT true NOT NULL,
	`game_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`ball_number` integer NOT NULL,
	`cumulative_score` integer NOT NULL,
	`drain_reason` text,
	`is_extra_ball` integer DEFAULT false NOT NULL,
	`tilted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_balls_needs_push` ON `balls` (`needs_push`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_balls_game_sequence` ON `balls` (`game_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`needs_push` integer DEFAULT true NOT NULL,
	`session_id` text NOT NULL,
	`game_number` integer NOT NULL,
	`player_count` integer DEFAULT 1 NOT NULL,
	`final_score` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_games_needs_push` ON `games` (`needs_push`);--> statement-breakpoint
CREATE INDEX `ix_games_session_id` ON `games` (`session_id`);--> statement-breakpoint
CREATE TABLE `machine_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`needs_push` integer DEFAULT true NOT NULL,
	`opdb_machine_id` text NOT NULL,
	`opdb_alias_id` text,
	`location_name` text NOT NULL,
	`balls_per_game` integer DEFAULT 3 NOT NULL,
	`ball_save_seconds` integer,
	`tilt_warnings` integer
);
--> statement-breakpoint
CREATE INDEX `ix_machine_instances_needs_push` ON `machine_instances` (`needs_push`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`needs_push` integer DEFAULT true NOT NULL,
	`game_id` text,
	`ball_id` text,
	`body` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ball_id`) REFERENCES `balls`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_notes_one_parent" CHECK(("notes"."game_id" IS NULL) <> ("notes"."ball_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `ix_notes_needs_push` ON `notes` (`needs_push`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`needs_push` integer DEFAULT true NOT NULL,
	`machine_instance_id` text NOT NULL,
	`code_version` text,
	`balls_per_game` integer NOT NULL,
	`ball_save_seconds` integer,
	`tilt_warnings` integer,
	`started_at` text NOT NULL,
	`ended_at` text,
	`source` text NOT NULL,
	FOREIGN KEY (`machine_instance_id`) REFERENCES `machine_instances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_sessions_needs_push` ON `sessions` (`needs_push`);--> statement-breakpoint
CREATE INDEX `ix_sessions_started_at` ON `sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
