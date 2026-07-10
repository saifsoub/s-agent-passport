CREATE TABLE `passkeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`credentialId` varchar(255) NOT NULL,
	`publicKey` text NOT NULL,
	`counter` int NOT NULL DEFAULT 0,
	`transports` varchar(255),
	`deviceType` varchar(32),
	`backedUp` int NOT NULL DEFAULT 0,
	`label` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	CONSTRAINT `passkeys_id` PRIMARY KEY(`id`),
	CONSTRAINT `passkeys_credentialId_unique` UNIQUE(`credentialId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `vaultLockEnabled` int DEFAULT 0 NOT NULL;