/**
 * Purpose: one merchant/store configuration.
 * Fields: merchant Basic credentials; Shopify OAuth creds; Partner CLI token.
 * Used by: dev routes, webhook verification, deploy helper, settlement logic.
 */
import { BaseEntity, Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { encryptedText } from '../../util/crypto';
import { WalletConnection } from './WalletConnection';
import { Order } from './Order';

@Entity('shops')
export class Shop extends BaseEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index({ unique: true }) @Column({ type: 'text' }) publicId!: string;
  @Index({ unique: true }) @Column({ type: 'text' }) domain!: string;

  @Column({ type: 'text', default: '' }) label!: string;
  @Column({ type: 'text', nullable: true }) merchantLogoUrl!: string | null;

  // Merchant portal (per-shop Basic+rotatable URL token)
  @Column({ type: 'text' }) merchantUser!: string;
  @Column({ type: 'text' }) merchantPasswordHash!: string;
  @Index({ unique: true }) @Column({ type: 'text' }) merchantUrlToken!: string;

  // Shopify Admin OAuth
  @Column({ type: 'text', transformer: encryptedText }) shopifyApiKey!: string;     // client_id
  @Column({ type: 'text', transformer: encryptedText }) shopifyApiSecret!: string;  // client_secret
  @Column({ type: 'text', transformer: encryptedText, nullable: true }) shopifyWebhookSecret!: string | null;
  @Column({ type: 'text', default: '' }) shopifyScopes!: string;
  @Column({ type: 'text', transformer: encryptedText, nullable: true }) shopifyAccessToken!: string | null;
  @Column({ type: 'datetime', nullable: true }) shopifyInstalledAt!: Date | null;

  // Shopify Partner CLI token for deploy
  @Column({ type: 'text', transformer: encryptedText, nullable: true }) partnerCliToken!: string | null;
  @Column({ type: 'datetime', nullable: true }) lastDeployedAt!: Date | null;

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;

  @OneToMany(() => WalletConnection, (w: WalletConnection) => w.shop, { cascade: true }) wallets!: WalletConnection[];
  @OneToMany(() => Order, (o: Order) => o.shop, { cascade: true }) orders!: Order[];
}