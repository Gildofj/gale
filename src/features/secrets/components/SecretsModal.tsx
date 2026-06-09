import { useEffect } from "react";
import { useSecretsStore } from "../store/secretsStore";
import { useWorkflowStore } from "../../workflow/store/workflowStore";
import { Modal } from "../../../shared/components/Modal";
import { Button } from "../../../shared/components/Button";
import { Input } from "../../../shared/components/Input";

export function SecretsModal() {
  const { repoPath } = useWorkflowStore();
  const {
    secrets,
    newSecretKey,
    newSecretValue,
    isSecretsModalOpen,
    setNewSecretKey,
    setNewSecretValue,
    setSecretsModalOpen,
    loadSecrets,
    addSecret,
    removeSecret,
    importFromEnv,
  } = useSecretsStore();

  // Carrega segredos automaticamente se o caminho do repositório mudar
  useEffect(() => {
    if (repoPath && isSecretsModalOpen) {
      loadSecrets(repoPath);
    }
  }, [repoPath, isSecretsModalOpen, loadSecrets]);

  const handleAddSecret = async () => {
    await addSecret(repoPath);
  };

  const handleRemoveSecret = async (key: string) => {
    await removeSecret(repoPath, key);
  };

  const handleImportFromEnv = async () => {
    await importFromEnv(repoPath);
  };

  return (
    <Modal
      isOpen={isSecretsModalOpen}
      onClose={() => setSecretsModalOpen(false)}
      title="🔑 Local Secrets"
      footer={
        <Button 
          variant="primary" 
          onClick={() => setSecretsModalOpen(false)}
        >
          Close
        </Button>
      }
    >
      <p className="text-xs text-brand-muted leading-relaxed">
        Add local secrets for this repository. They are stored securely in your app data folder and never exposed to any database.
      </p>
      
      <div className="flex justify-between items-center bg-brand-primary-light border border-brand-primary/20 rounded-md p-3 select-none">
        <span className="text-xs text-brand-text font-medium">Have a local .env file?</span>
        <Button
          variant="primary"
          size="sm"
          onClick={handleImportFromEnv}
        >
          Import .env File
        </Button>
      </div>
      
      {/* Secrets List */}
      <div className="flex flex-col gap-2 max-h-50 overflow-y-auto pr-1 custom-scrollbar">
        {Object.keys(secrets).length === 0 ? (
          <div className="text-center text-xs text-brand-dark italic py-4">
            No secrets configured for this repository yet.
          </div>
        ) : (
          Object.keys(secrets).map((key) => (
            <div key={key} className="flex justify-between items-center p-2 bg-brand-bg border border-brand-border rounded-md text-xs">
              <div className="font-mono text-brand-primary font-semibold truncate mr-2 select-text">{key}</div>
              <div className="flex items-center gap-2 select-none">
                <span className="text-brand-muted font-mono">******</span>
                <button 
                  className="text-brand-danger hover:text-brand-danger/80 cursor-pointer font-medium ml-1 transition-colors duration-150"
                  onClick={() => handleRemoveSecret(key)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add New Secret Form */}
      <div className="border-t border-brand-border pt-4 flex flex-col gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted select-none">Add New Secret</span>
        <div className="flex flex-col gap-2">
          <Input
            type="text"
            placeholder="SECRET_NAME"
            value={newSecretKey}
            onChange={(e) => setNewSecretKey(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Secret Value"
            value={newSecretValue}
            onChange={(e) => setNewSecretValue(e.target.value)}
          />
          <Button
            variant="primary"
            onClick={handleAddSecret}
            disabled={!newSecretKey.trim() || !newSecretValue.trim()}
            className="mt-1"
          >
            Add Secret
          </Button>
        </div>
      </div>
    </Modal>
  );
}
