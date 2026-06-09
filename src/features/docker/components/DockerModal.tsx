import { useState, useEffect } from "react";
import { useDockerStore } from "../store/dockerStore";
import { Modal } from "../../../shared/components/Modal";
import { Button } from "../../../shared/components/Button";

type TabType = "containers" | "images" | "volumes" | "settings";

export function DockerModal() {
  const {
    isModalOpen,
    summary,
    containers,
    images,
    volumes,
    loading,
    autoPruneOnStartup,
    autoPruneOnWorkspaceSwitch,
    setModalOpen,
    fetchStats,
    pruneContainers,
    pruneVolumes,
    pruneImages,
    deleteContainer,
    deleteImage,
    toggleSetting,
  } = useDockerStore();

  const [activeTab, setActiveTab] = useState<TabType>("containers");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Clear action message after 4 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  const handlePruneContainers = async () => {
    setActionMessage("Pruning stopped containers...");
    const count = await pruneContainers();
    setActionMessage(`Pruned ${count} stopped containers!`);
  };

  const handlePruneVolumes = async () => {
    setActionMessage("Pruning unused volumes...");
    const count = await pruneVolumes();
    setActionMessage(`Pruned ${count} unused volumes!`);
  };

  const handlePruneImages = async () => {
    setActionMessage("Pruning dangling images...");
    await pruneImages();
    setActionMessage("Pruned dangling images successfully!");
  };

  const handleDeleteContainer = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to force delete container ${name}?`)) {
      setActionMessage(`Deleting container ${name}...`);
      await deleteContainer(id);
      setActionMessage(`Container ${name} deleted.`);
    }
  };

  const handleDeleteImage = async (id: string, repo: string) => {
    if (confirm(`Are you sure you want to force delete image ${repo}?`)) {
      setActionMessage(`Deleting image ${repo}...`);
      await deleteImage(id);
      setActionMessage(`Image ${repo} deleted.`);
    }
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={() => setModalOpen(false)}
      title="🐳 Docker Resource Manager"
      widthClass="w-[580px]"
      footer={
        <div className="flex justify-between items-center w-full">
          <div className="text-[11px] text-brand-muted font-medium truncate max-w-[320px]">
            {actionMessage && (
              <span className="text-brand-success bg-brand-success-light px-2 py-1 rounded border border-brand-success/20 animate-pulse">
                {actionMessage}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={fetchStats} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      {/* Space Usage Banner */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-brand-bg/50 border border-brand-border rounded-lg text-xs select-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wide">Containers Size</span>
          <span className="font-semibold font-mono text-brand-text">
            {summary?.containers_size || "0 B"}
          </span>
          <span className="text-[10px] text-brand-dark">
            {summary?.containers_reclaimable && `Reclaimable: ${summary.containers_reclaimable}`}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-l border-brand-border/50 pl-3">
          <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wide">Volumes Size</span>
          <span className="font-semibold font-mono text-brand-text">
            {summary?.volumes_size || "0 B"}
          </span>
          <span className="text-[10px] text-brand-dark">
            {summary?.volumes_reclaimable && `Reclaimable: ${summary.volumes_reclaimable}`}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-l border-brand-border/50 pl-3">
          <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wide">Images Size</span>
          <span className="font-semibold font-mono text-brand-text">
            {summary?.images_size || "0 B"}
          </span>
          <span className="text-[10px] text-brand-dark">
            {summary?.images_reclaimable && `Reclaimable: ${summary.images_reclaimable}`}
          </span>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-brand-border/60 select-none">
        {(["containers", "images", "volumes", "settings"] as TabType[]).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-xs font-semibold capitalize cursor-pointer border-b-2 -mb-[2px] transition-all duration-150 ${
              activeTab === tab
                ? "border-brand-primary text-brand-primary font-bold"
                : "border-transparent text-brand-muted hover:text-brand-text"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 flex flex-col min-h-[260px] max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-12 gap-3 text-brand-muted text-xs select-none">
            <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
            <span>Scanning Docker assets...</span>
          </div>
        ) : (
          <>
            {activeTab === "containers" && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-brand-panel-header/50 p-2 rounded border border-brand-border/30 mb-2 select-none">
                  <span className="text-[11px] text-brand-muted font-medium">
                    Manage act/gale runner containers.
                  </span>
                  <Button variant="secondary" size="sm" onClick={handlePruneContainers}>
                    Prune Stopped
                  </Button>
                </div>
                {containers.length === 0 ? (
                  <div className="text-center text-xs text-brand-dark italic py-8 select-none">
                    No containers found in Docker.
                  </div>
                ) : (
                  containers.map((c) => (
                    <div
                      key={c.id}
                      className={`flex justify-between items-center p-2.5 rounded border text-xs transition-colors ${
                        c.is_act
                          ? "bg-brand-primary-light/40 border-brand-primary/20 hover:bg-brand-primary-light/50"
                          : "bg-brand-bg/40 border-brand-border/40 hover:bg-brand-bg/70"
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-semibold font-mono text-brand-text truncate block max-w-[320px]" title={c.name}>
                            {c.name}
                          </span>
                          {c.is_act && (
                            <span className="text-[9px] bg-brand-primary/20 text-brand-primary font-bold px-1 py-0.2 rounded border border-brand-primary/30 uppercase select-none">
                              act run
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-brand-muted font-mono truncate" title={c.image}>
                          Image: {c.image}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 select-none">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            c.status.toLowerCase().includes("up")
                              ? "bg-brand-success-light text-brand-success"
                              : "bg-brand-dark/20 text-brand-muted"
                          }`}
                        >
                          {c.status.toLowerCase().includes("up") ? "Running" : "Stopped"}
                        </span>
                        <button
                          className="text-brand-danger hover:text-brand-danger/80 cursor-pointer font-medium text-[11px] transition-colors"
                          onClick={() => handleDeleteContainer(c.id, c.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "images" && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-brand-panel-header/50 p-2 rounded border border-brand-border/30 mb-2 select-none">
                  <span className="text-[11px] text-brand-muted font-medium">
                    Remove runner environment images when not in use.
                  </span>
                  <Button variant="secondary" size="sm" onClick={handlePruneImages}>
                    Prune Dangling
                  </Button>
                </div>
                {images.length === 0 ? (
                  <div className="text-center text-xs text-brand-dark italic py-8 select-none">
                    No images found in Docker.
                  </div>
                ) : (
                  images.map((img) => (
                    <div
                      key={img.id}
                      className={`flex justify-between items-center p-2.5 rounded border text-xs transition-colors ${
                        img.is_act
                          ? "bg-brand-primary-light/40 border-brand-primary/20 hover:bg-brand-primary-light/50"
                          : "bg-brand-bg/40 border-brand-border/40 hover:bg-brand-bg/70"
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-semibold font-mono text-brand-text truncate block max-w-[320px]" title={img.repository}>
                            {img.repository}
                          </span>
                          {img.is_act && (
                            <span className="text-[9px] bg-brand-primary/20 text-brand-primary font-bold px-1 py-0.2 rounded border border-brand-primary/30 uppercase select-none">
                              act environment
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-brand-muted font-mono">
                          Tag: <span className="text-brand-text">{img.tag}</span> | ID: {img.id.slice(0, 12)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 select-none">
                        <span className="text-[10px] text-brand-muted font-mono bg-brand-panel px-1.5 py-0.5 rounded border border-brand-border">
                          {img.size}
                        </span>
                        <button
                          className="text-brand-danger hover:text-brand-danger/80 cursor-pointer font-medium text-[11px] transition-colors"
                          onClick={() => handleDeleteImage(img.id, img.repository)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "volumes" && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-brand-panel-header/50 p-2 rounded border border-brand-border/30 mb-2 select-none">
                  <span className="text-[11px] text-brand-muted font-medium">
                    Clean workspace execution caches.
                  </span>
                  <Button variant="secondary" size="sm" onClick={handlePruneVolumes}>
                    Prune Dangling
                  </Button>
                </div>
                {volumes.length === 0 ? (
                  <div className="text-center text-xs text-brand-dark italic py-8 select-none">
                    No volumes found in Docker.
                  </div>
                ) : (
                  volumes.map((v) => (
                    <div
                      key={v.name}
                      className={`flex justify-between items-center p-2.5 rounded border text-xs transition-colors ${
                        v.name === "act-toolcache"
                          ? "bg-brand-success-light/35 border-brand-success/20 hover:bg-brand-success-light/45"
                          : v.is_act
                          ? "bg-brand-primary-light/40 border-brand-primary/20 hover:bg-brand-primary-light/50"
                          : "bg-brand-bg/40 border-brand-border/40 hover:bg-brand-bg/70"
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-semibold font-mono text-brand-text truncate block select-text" title={v.name}>
                            {v.name}
                          </span>
                          {v.name === "act-toolcache" ? (
                            <span className="text-[9px] bg-brand-success/20 text-brand-success font-bold px-1 py-0.2 rounded border border-brand-success/30 uppercase select-none">
                              System Cache (Preserved)
                            </span>
                          ) : (
                            v.is_act && (
                              <span className="text-[9px] bg-brand-primary/20 text-brand-primary font-bold px-1 py-0.2 rounded border border-brand-primary/30 uppercase select-none">
                                Job Volume
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      <div className="flex items-center select-none text-[10px] text-brand-muted">
                        {v.name === "act-toolcache" ? (
                          <span className="text-brand-success font-medium">Safe</span>
                        ) : (
                          <span className="text-brand-dark italic">Removes on container prune</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "settings" && (
              <div className="flex flex-col gap-4 p-2 select-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                  Auto-Cleanup Strategies
                </span>

                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start p-3 bg-brand-panel-header/20 border border-brand-border/60 rounded-md">
                    <div className="flex-1 mr-4">
                      <span className="block text-xs font-semibold text-brand-text mb-0.5">
                        Clean on Workspace Switch
                      </span>
                      <span className="block text-[10px] text-brand-muted leading-relaxed">
                        Automatically removes stopped act containers and workspace cache volumes when you switch to a different repository folder.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={autoPruneOnWorkspaceSwitch}
                        onChange={() => toggleSetting("autoPruneOnWorkspaceSwitch")}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-brand-dark/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-brand-text after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                    </label>
                  </div>

                  <div className="flex justify-between items-start p-3 bg-brand-panel-header/20 border border-brand-border/60 rounded-md">
                    <div className="flex-1 mr-4">
                      <span className="block text-xs font-semibold text-brand-text mb-0.5">
                        Clean on Application Startup
                      </span>
                      <span className="block text-[10px] text-brand-muted leading-relaxed">
                        Automatically purges stopped run containers from previous sessions when Gale launches, restoring disk space immediately.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={autoPruneOnStartup}
                        onChange={() => toggleSetting("autoPruneOnStartup")}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-brand-dark/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-brand-text after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
