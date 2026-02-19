import { useParams } from 'react-router-dom';

export default function ContractDetailPage() {
    const { id } = useParams<{ id: string }>();
    return (
        <div className="animate-fade-up">
            <h1 className="text-2xl font-bold text-content-primary mb-1">Contract Detail</h1>
            <p className="text-content-muted text-sm font-mono">ID: {id} — coming in Module F6</p>
        </div>
    );
}
