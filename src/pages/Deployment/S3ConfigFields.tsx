const inputClass =
  'w-full px-3 py-2 rounded border border-hairline-divider bg-surface-white text-sm text-primary-ink placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';
const labelClass = 'block text-xs font-semibold text-secondary-ink mb-1.5';

interface S3ConfigFieldsProps {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  objectKey: string;
  forcePathStyle: boolean;
  onBucketChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  onAccessKeyIdChange: (value: string) => void;
  onAccessKeySecretChange: (value: string) => void;
  onObjectKeyChange: (value: string) => void;
  onForcePathStyleChange: (value: boolean) => void;
}

export default function S3ConfigFields({
  bucket,
  region,
  endpoint,
  accessKeyId,
  accessKeySecret,
  objectKey,
  forcePathStyle,
  onBucketChange,
  onRegionChange,
  onEndpointChange,
  onAccessKeyIdChange,
  onAccessKeySecretChange,
  onObjectKeyChange,
  onForcePathStyleChange,
}: S3ConfigFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded border border-hairline-divider bg-section-layer/40 p-3">
      <div>
        <label htmlFor="deploy-s3-bucket" className={labelClass}>S3 Bucket</label>
        <input
          id="deploy-s3-bucket"
          aria-label="S3 Bucket"
          type="text"
          value={bucket}
          onChange={(event) => onBucketChange(event.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="deploy-s3-region" className={labelClass}>S3 Region</label>
        <input
          id="deploy-s3-region"
          aria-label="S3 Region"
          type="text"
          value={region}
          onChange={(event) => onRegionChange(event.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="deploy-s3-endpoint" className={labelClass}>S3 Endpoint（可选）</label>
        <input
          id="deploy-s3-endpoint"
          aria-label="S3 Endpoint"
          type="text"
          value={endpoint}
          onChange={(event) => onEndpointChange(event.target.value)}
          placeholder="https://s3.example.com"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="deploy-s3-access-key-id" className={labelClass}>S3 AccessKey ID</label>
        <input
          id="deploy-s3-access-key-id"
          aria-label="S3 AccessKey ID"
          type="text"
          value={accessKeyId}
          onChange={(event) => onAccessKeyIdChange(event.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="deploy-s3-access-key-secret" className={labelClass}>S3 AccessKey Secret</label>
        <input
          id="deploy-s3-access-key-secret"
          aria-label="S3 AccessKey Secret"
          type="password"
          value={accessKeySecret}
          onChange={(event) => onAccessKeySecretChange(event.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="deploy-s3-object-key" className={labelClass}>S3 ObjectKey</label>
        <input
          id="deploy-s3-object-key"
          aria-label="S3 ObjectKey"
          type="text"
          value={objectKey}
          onChange={(event) => onObjectKeyChange(event.target.value)}
          placeholder="path/to/alpine.raw"
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
        <input
          type="checkbox"
          aria-label="S3 ForcePathStyle"
          checked={forcePathStyle}
          onChange={(event) => onForcePathStyleChange(event.target.checked)}
          className="rounded text-primary"
        />
        S3 ForcePathStyle（兼容 MinIO/Ceph 等自定义 endpoint）
      </label>
    </div>
  );
}
