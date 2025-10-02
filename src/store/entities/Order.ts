/**
 * Purpose: track a single BOLT11 and its lifecycle; link to Shopify order GID; store display summary and memo used.
 * Used by: invoice creation, polling/notifications settlement, merchant UI.
 */
import { BaseEntity, Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Shop } from './Shop';

@Entity('orders')
export class Order extends BaseEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @ManyToOne(() => Shop, (s: Shop) => s.orders, { eager: true, onDelete: 'CASCADE' })
  shop!: Shop;

  @Index() @Column({ type: 'text', nullable: true }) orderGid!: string | null;
  @Index() @Column({ type: 'text', nullable: true }) checkoutToken!: string | null;

  @Index({ unique: true }) @Column({ type: 'text' }) invoiceRef!: string;

  @Column({ type: 'text' }) presentmentCurrency!: string;
  @Column({ type: 'real' }) amountPresentment!: number;
  @Column({ type: 'text' }) msat!: string;

  @Column({ type: 'text', default: 'awaiting_payment' })
  status!: 'awaiting_payment' | 'paid' | 'captured' | 'failed';

  @Column({ type: 'text' }) bolt11!: string;
  @Index({ unique: true }) @Column({ type: 'text', nullable: true }) paymentHash!: string | null;
  @Column({ type: 'text', nullable: true }) preimage!: string | null;

  // Merchant display and LN memo
  @Column({ type: 'text', nullable: true }) shopifyOrderName!: string | null;      // e.g. "#1001"
  @Column({ type: 'integer', nullable: true }) shopifyOrderNumber!: number | null;
  @Column({ type: 'text', nullable: true }) customerNote!: string | null;
  @Column({ type: 'text', nullable: true }) shopifyTags!: string | null;
  @Column({ type: 'text', nullable: true }) orderSummary!: string | null;          // "2× Tee (M), 1× Hoodie (L) — 123.45 USD"
  @Column({ type: 'text', nullable: true }) bolt11Memo!: string | null;            // ≤100 chars sent to wallet
  @Column({ type: 'text', nullable: true }) redirectUrl!: string | null;           // Shopify order status URL

  @Column({ type: 'datetime', nullable: true }) paidAt!: Date | null;
  @Column({ type: 'real', nullable: true }) exchangeRateUsed!: number | null;

  @Column({ type: 'datetime' }) expiresAt!: Date;
  @Column({ type: 'datetime', nullable: true }) nextPollAt!: Date | null;
  @Column({ type: 'integer', default: 0 }) pollAttempts!: number;

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}