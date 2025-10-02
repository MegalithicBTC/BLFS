/**
 * Purpose: NWC binding per shop with capability probe + notifications support.
 * Used by: onboarding verification; invoice creation; notifications listener.
 */
import { BaseEntity, Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { encryptedText } from '../../util/crypto';
import { Shop } from './Shop';

@Entity('wallet_connections')
export class WalletConnection extends BaseEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @ManyToOne(() => Shop, (s: Shop) => s.wallets, { eager: true, onDelete: 'CASCADE' })
  shop!: Shop;

  @Column({ type: 'text', transformer: encryptedText }) nwcUri!: string;
  @Index() @Column({ type: 'text' }) walletPubkey!: string;

  @Column({ type: 'datetime', nullable: true }) infoLastCheckedAt!: Date | null;
  @Column({ type: 'boolean', default: false }) failedReadOnlyValidation!: boolean;
}