/**
 * ContractCard.tsx
 *
 * Grid / list card for a single contract in ContractsPage.
 * Shows: name, type badge, counterparty, status, risk score, expiry.
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Clock, RefreshCw } from 'lucide-react';
import type { ContractListItem } from '@/types/contract.types';
import {
    cn,
    formatDate,
    formatExpiration,
    scoreToRiskLabel,
    riskLabelToBadgeClass,
    statusToBadgeClass,
    statusToLabel,
    CONTRACT_TYPE_LABELS,
} from '@/lib/utils';

interface ContractCardProps {
    contract: ContractListItem;
    index?: number;
}

export default function ContractCard({ contract, index = 0 }: ContractCardProps) {
    const { isExpired, isExpiringSoon } = formatExpiration(contract.expiration_date);
    const riskLabel = scoreToRiskLabel(contract.risk_score);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.04, ease: 'easeOut' }}
        >
            <Link
                to={`/contracts/${contract.id}`}
                className="group card flex flex-col gap-3 p-4 hover:border-brand-500/40 transition-all duration-200 hover:shadow-glow-sm"
            >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                    {/* Icon + name */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                            <FileText className="h-4 w-4 text-brand-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-content-primary truncate group-hover:text-brand-400 transition-colors">
                                {contract.name}
                            </p>
                            {contract.counterparty && (
                                <p className="text-xs text-content-muted truncate mt-0.5">
                                    {contract.counterparty}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Risk score badge */}
                    {contract.status === 'active' && contract.risk_score !== null ? (
                        <span className={cn('badge shrink-0', riskLabelToBadgeClass(riskLabel))}>
                            {contract.risk_score}
                        </span>
                    ) : (
                        <span className={cn('badge shrink-0', statusToBadgeClass(contract.status))}>
                            {statusToLabel(contract.status)}
                        </span>
                    )}
                </div>

                {/* Middle row: type + status */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-neutral text-xs">
                        {CONTRACT_TYPE_LABELS[contract.type]}
                    </span>
                    {contract.status === 'active' && contract.risk_score !== null && (
                        <span className={cn('badge text-xs', statusToBadgeClass(contract.status))}>
                            {statusToLabel(contract.status)}
                        </span>
                    )}
                    {contract.status === 'processing' && (
                        <span className="flex items-center gap-1 text-xs text-brand-400">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Analysing…
                        </span>
                    )}
                </div>

                {/* Bottom row: expiry + date */}
                <div className="flex items-center justify-between text-xs text-content-muted mt-auto">
                    {contract.expiration_date ? (
                        <span className={cn(
                            'flex items-center gap-1',
                            isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : '',
                        )}>
                            <Clock className="h-3 w-3" />
                            {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring' : 'Expires'}{' '}
                            {formatDate(contract.expiration_date)}
                        </span>
                    ) : (
                        <span />
                    )}
                    <span>{formatDate(contract.created_at)}</span>
                </div>
            </Link>
        </motion.div>
    );
}
