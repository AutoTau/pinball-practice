CREATE TABLE `catalog_machines` (
	`opdb_id` text PRIMARY KEY NOT NULL,
	`opdb_machine_id` text NOT NULL,
	`opdb_alias_id` text,
	`name` text NOT NULL,
	`short_name` text,
	`title_group_name` text NOT NULL,
	`manufacturer` text,
	`year` integer,
	`display` text,
	`retired` integer DEFAULT false NOT NULL,
	`pinball_primer_url` text,
	`pinball_rules_url` text,
	`bobs_guide_url` text
);
