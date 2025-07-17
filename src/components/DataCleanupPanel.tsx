import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';
import { cleanupOrphanedData, validateOrphanedData } from '~/utils/dataCleanup';

const BorderColor = '#e5e7eb';

interface CleanupStats {
  orphanedCards: number;
  practiceRecords: number;
  storageSize: string;
  orphanedUids: string[];
}

interface CleanupResult {
  success: boolean;
  cleanedCount: number;
  errors: string[];
}

const Dialog = styled(Blueprint.Dialog)`
  width: 90%;
  max-width: 600px;
`;

const FormLabel = styled.div`
  margin-top: 0 !important;
  margin-bottom: 5px;
`;

const StatCard = styled.div`
  border: 1px solid ${BorderColor};
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
  background-color: #f8f9fa;
`;

const OrphanedCardsList = ({ orphanedUids, blockInfoMap }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  if (orphanedUids.length === 0) return null;

  return (
    <div className="mt-3">
      <div 
        className="flex items-center cursor-pointer text-sm text-gray-600 hover:text-gray-800"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Blueprint.Icon 
          icon="chevron-down" 
          className={`mr-2 ${isExpanded ? 'transform rotate-180' : ''}`} 
        />
        查看将被清理的卡片列表 ({orphanedUids.length} 张)
      </div>
      
      {isExpanded && (
        <div className="mt-2 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
          {orphanedUids.slice(0, 20).map((uid) => (
            <div key={uid} className="text-xs text-gray-500 truncate">
              {blockInfoMap[uid]?.string || `已删除的卡片 (${uid.substring(0, 8)}...)`}
            </div>
          ))}
          {orphanedUids.length > 20 && (
            <div className="text-xs text-gray-400 mt-1">
              ... 还有 {orphanedUids.length - 20} 张卡片
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CleanupStatsDisplay = ({ stats }: { stats: CleanupStats }) => (
  <div className="mb-4">
    <StatCard>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">孤立卡片数量</span>
        <span className="text-lg font-bold text-orange-600">{stats.orphanedCards}</span>
      </div>
    </StatCard>
    
    <StatCard>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">孤立练习记录</span>
        <span className="text-lg font-bold text-red-600">{stats.practiceRecords}</span>
      </div>
    </StatCard>
    
    <StatCard>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">预估释放空间</span>
        <span className="text-lg font-bold text-blue-600">{stats.storageSize}</span>
      </div>
    </StatCard>
  </div>
);

const ProgressOverlay = ({ isVisible, progress, statusText }) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 flex flex-col bg-white bg-opacity-95 z-10">
      <div className="py-5 px-5 flex h-full flex-col justify-center items-center">
        <h4 className="bp3-heading mb-3">{statusText}</h4>
        <Blueprint.ProgressBar
          intent="primary"
          animate={true}
          stripes={true}
          value={progress}
          className="mb-3 w-full max-w-md"
        />
        <FormLabel className="bp3-form-helper-text text-center">
          正在处理数据，请耐心等待...
        </FormLabel>
      </div>
    </div>
  );
};

const CleanupConfirmationDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  stats, 
  isLoading 
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: CleanupStats;
  isLoading: boolean;
}) => (
  <Blueprint.Dialog
    isOpen={isOpen}
    onClose={onClose}
    title="确认清理数据"
    canEscapeKeyClose={!isLoading}
    canOutsideClickClose={!isLoading}
  >
    <div className="bp3-dialog-body">
      <div className="mb-4">
        <Blueprint.Callout intent="warning" icon="warning-sign">
          <h4 className="bp3-heading">⚠️ 警告：此操作不可逆</h4>
          <p className="mb-2">
            您即将删除 <strong>{stats.orphanedCards}</strong> 张孤立卡片的所有历史数据，
            包括 <strong>{stats.practiceRecords}</strong> 条练习记录。
          </p>
          <p className="text-sm text-gray-600">
            这些数据一旦删除将无法恢复，请确保您不再需要这些历史信息。
          </p>
        </Blueprint.Callout>
      </div>
      
      <div className="mb-4">
        <h5 className="bp3-heading">将被清理的数据：</h5>
        <ul className="text-sm text-gray-600 mt-2 pl-4">
          <li>• 已删除卡片的练习历史记录</li>
          <li>• 优先级数组中的无效引用</li>
          <li>• 相关缓存数据</li>
        </ul>
      </div>
    </div>
    
    <div className="bp3-dialog-footer">
      <div className="bp3-dialog-footer-actions">
        <Blueprint.Button onClick={onClose} disabled={isLoading}>
          取消
        </Blueprint.Button>
        <Blueprint.Button 
          intent="danger" 
          onClick={onConfirm} 
          loading={isLoading}
          disabled={isLoading}
        >
          确认清理
        </Blueprint.Button>
      </div>
    </div>
  </Blueprint.Dialog>
);

const DataCleanupPanel = ({ dataPageTitle }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isCleaning, setIsCleaning] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [stats, setStats] = React.useState<CleanupStats | null>(null);
  const [result, setResult] = React.useState<CleanupResult | null>(null);
  const [blockInfoMap, setBlockInfoMap] = React.useState({});
  const [lastCleanupDate, setLastCleanupDate] = React.useState<string | null>(null);

  // Load last cleanup date from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('memo-last-cleanup');
    if (saved) {
      setLastCleanupDate(saved);
    }
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    setStats(null);
    setResult(null);
    
    try {
      const scanResult = await validateOrphanedData(dataPageTitle);
      
      // Fetch block info for orphaned cards (for display purposes)
      const newBlockInfoMap = {};
      for (const uid of scanResult.orphanedUids.slice(0, 20)) {
        try {
          const blockInfo = await window.roamAlphaAPI.q(
            `[:find (pull ?block [:block/string]) :in $ ?uid :where [?block :block/uid ?uid]]`,
            uid
          );
          if (blockInfo && blockInfo[0] && blockInfo[0][0]) {
            newBlockInfoMap[uid] = blockInfo[0][0];
          }
        } catch (e) {
          // Block doesn't exist, which is expected for orphaned cards
        }
      }
      setBlockInfoMap(newBlockInfoMap);
      
      setStats({
        orphanedCards: scanResult.orphanedCount,
        practiceRecords: scanResult.practiceRecords,
        storageSize: scanResult.storageSize,
        orphanedUids: scanResult.orphanedUids
      });
    } catch (error) {
      console.error('扫描失败:', error);
      setResult({
        success: false,
        cleanedCount: 0,
        errors: [error.message]
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleCleanup = async () => {
    setIsCleaning(true);
    setShowConfirmDialog(false);
    
    try {
      const cleanupResult = await cleanupOrphanedData({
        dataPageTitle,
        dryRun: false,
        batchSize: 30
      });
      
      setResult({
        success: true,
        cleanedCount: cleanupResult.cleanedCount,
        errors: cleanupResult.errors
      });
      
      // Save cleanup date
      const now = new Date().toLocaleDateString('zh-CN');
      localStorage.setItem('memo-last-cleanup', now);
      setLastCleanupDate(now);
      
      // Reset stats since data has been cleaned
      setStats(null);
      
    } catch (error) {
      console.error('清理失败:', error);
      setResult({
        success: false,
        cleanedCount: 0,
        errors: [error.message]
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleConfirmCleanup = () => {
    if (stats && stats.orphanedCards > 0) {
      setShowConfirmDialog(true);
    }
  };

  return (
    <div>
      <Blueprint.Button 
        icon="trash" 
        onClick={() => setIsOpen(true)}
        intent="warning"
        outlined
      >
        清理孤立数据
      </Blueprint.Button>
      
      {lastCleanupDate && (
        <div className="text-xs text-gray-500 mt-1">
          上次清理: {lastCleanupDate}
        </div>
      )}

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="🧹 清理孤立数据"
        className="bp3-ui-text pb-0 bg-white select-none"
        canEscapeKeyClose={!isScanning && !isCleaning}
        canOutsideClickClose={!isScanning && !isCleaning}
      >
        <div className="bp3-dialog-body relative">
          <ProgressOverlay
            isVisible={isScanning || isCleaning}
            progress={isScanning ? 0.5 : 0.8}
            statusText={isScanning ? '正在扫描孤立数据...' : '正在清理数据...'}
          />
          
          <div className="mb-4">
            <FormLabel className="bp3-form-helper-text">
              扫描并清理已删除卡片的历史数据，释放存储空间并优化性能。
            </FormLabel>
          </div>

          {stats && (
            <div>
              <h5 className="bp3-heading mb-3">扫描结果</h5>
              <CleanupStatsDisplay stats={stats} />
              
              <OrphanedCardsList 
                orphanedUids={stats.orphanedUids}
                blockInfoMap={blockInfoMap}
              />
            </div>
          )}

          {result && (
            <div className="mt-4">
              <Blueprint.Callout 
                intent={result.success ? 'success' : 'danger'}
                icon={result.success ? 'tick-circle' : 'error'}
              >
                {result.success ? (
                  <div>
                    <h5 className="bp3-heading">✅ 清理完成</h5>
                    <p>成功清理了 {result.cleanedCount} 张孤立卡片的数据</p>
                  </div>
                ) : (
                  <div>
                    <h5 className="bp3-heading">❌ 清理失败</h5>
                    <p>清理过程中发生错误:</p>
                    <ul className="mt-2">
                      {result.errors.map((error, i) => (
                        <li key={i} className="text-sm">• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Blueprint.Callout>
            </div>
          )}
        </div>

        <div className="bp3-dialog-footer">
          <div className="bp3-dialog-footer-actions">
            <Blueprint.Button 
              onClick={() => setIsOpen(false)}
              disabled={isScanning || isCleaning}
            >
              关闭
            </Blueprint.Button>
            
            <Blueprint.Button 
              icon="search"
              intent="primary"
              onClick={handleScan}
              loading={isScanning}
              disabled={isScanning || isCleaning}
            >
              扫描孤立数据
            </Blueprint.Button>
            
            {stats && stats.orphanedCards > 0 && (
              <Blueprint.Button 
                icon="trash"
                intent="danger"
                onClick={handleConfirmCleanup}
                disabled={isScanning || isCleaning}
              >
                清理数据 ({stats.orphanedCards})
              </Blueprint.Button>
            )}
          </div>
        </div>
      </Dialog>

      {stats && (
        <CleanupConfirmationDialog
          isOpen={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={handleCleanup}
          stats={stats}
          isLoading={isCleaning}
        />
      )}
    </div>
  );
};

export default DataCleanupPanel;