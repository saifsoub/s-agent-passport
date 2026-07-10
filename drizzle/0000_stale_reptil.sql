CREATE TABLE `passport_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agentName` varchar(128) NOT NULL,
	`agentType` varchar(64) NOT NULL,
	`toolIds` json NOT NULL,
	`secretKeys` json NOT NULL,
	`ttlHours` int,
	`purpose` text,
	`status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
	`decidedBy` varchar(128),
	`decidedAt` timestamp,
	`denialReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passport_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`passportId` varchar(32) NOT NULL,
	`requestId` int NOT NULL,
	`userId` int NOT NULL,
	`agentName` varchar(128) NOT NULL,
	`agentType` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`checksum` varchar(32) NOT NULL,
	`signature` text,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`revokeReason` text,
	CONSTRAINT `passports_id` PRIMARY KEY(`id`),
	CONSTRAINT `passports_passportId_unique` UNIQUE(`passportId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `vault_secrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`keyName` varchar(128) NOT NULL,
	`valueEncrypted` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vault_secrets_id` PRIMARY KEY(`id`)
);
