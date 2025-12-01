package storage

import (
	"context"
	"fmt"
	"io"
	"log"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// MinIOClient wraps MinIO client with bucket management
type MinIOClient struct {
	client    *minio.Client
	k8sClient *kubernetes.Clientset
}

// MinIOConfig holds MinIO connection configuration
type MinIOConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	UseSSL    bool
}

// NewMinIOClientFromK8s creates a MinIO client using credentials from Kubernetes secret
func NewMinIOClientFromK8s(ctx context.Context, k8sClient *kubernetes.Clientset, namespace string) (*MinIOClient, error) {
	// Get MinIO credentials from secret
	secret, err := k8sClient.CoreV1().Secrets(namespace).Get(ctx, "minio-secret", metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get minio-secret: %w", err)
	}

	endpoint := string(secret.Data["endpoint"])
	accessKey := string(secret.Data["accesskey"])
	secretKey := string(secret.Data["secretkey"])

	if endpoint == "" || accessKey == "" || secretKey == "" {
		return nil, fmt.Errorf("minio-secret is missing required fields (endpoint, accesskey, secretkey)")
	}

	// Initialize MinIO client
	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: false, // Set to true if using HTTPS
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize MinIO client: %w", err)
	}

	log.Printf("MinIO client initialized for namespace %s (endpoint: %s)", namespace, endpoint)

	return &MinIOClient{
		client:    minioClient,
		k8sClient: k8sClient,
	}, nil
}

// NewMinIOClient creates a MinIO client with explicit configuration
func NewMinIOClient(config MinIOConfig) (*MinIOClient, error) {
	minioClient, err := minio.New(config.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(config.AccessKey, config.SecretKey, ""),
		Secure: config.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize MinIO client: %w", err)
	}

	return &MinIOClient{
		client:    minioClient,
		k8sClient: nil,
	}, nil
}

// EnsureBucket creates a bucket if it doesn't exist
func (m *MinIOClient) EnsureBucket(ctx context.Context, bucketName string) error {
	exists, err := m.client.BucketExists(ctx, bucketName)
	if err != nil {
		return fmt.Errorf("failed to check if bucket exists: %w", err)
	}

	if !exists {
		log.Printf("Creating MinIO bucket: %s", bucketName)
		err = m.client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
		if err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}
		log.Printf("Bucket %s created successfully", bucketName)
	} else {
		log.Printf("Bucket %s already exists", bucketName)
	}

	return nil
}

// UploadFile uploads a file to MinIO
func (m *MinIOClient) UploadFile(ctx context.Context, bucketName, objectName string, reader io.Reader, size int64, contentType string) (minio.UploadInfo, error) {
	// Ensure bucket exists
	if err := m.EnsureBucket(ctx, bucketName); err != nil {
		return minio.UploadInfo{}, err
	}

	// Upload the file
	uploadInfo, err := m.client.PutObject(ctx, bucketName, objectName, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return minio.UploadInfo{}, fmt.Errorf("failed to upload file: %w", err)
	}

	log.Printf("File uploaded successfully: %s/%s (size: %d bytes)", bucketName, objectName, uploadInfo.Size)
	return uploadInfo, nil
}

// GetObject retrieves an object from MinIO
func (m *MinIOClient) GetObject(ctx context.Context, bucketName, objectName string) (*minio.Object, error) {
	object, err := m.client.GetObject(ctx, bucketName, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get object: %w", err)
	}
	return object, nil
}

// DeleteObject deletes an object from MinIO
func (m *MinIOClient) DeleteObject(ctx context.Context, bucketName, objectName string) error {
	err := m.client.RemoveObject(ctx, bucketName, objectName, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}
	log.Printf("Object deleted: %s/%s", bucketName, objectName)
	return nil
}

// ListObjects lists objects in a bucket with a prefix
func (m *MinIOClient) ListObjects(ctx context.Context, bucketName, prefix string) <-chan minio.ObjectInfo {
	return m.client.ListObjects(ctx, bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})
}
