export default function Loader({ message = "Loading..." }) {
    return (
        <div className="flex items-center justify-center min-h-[400px] text-slate-500">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                <p>{message}</p>
            </div>
        </div>
    );
}
