#import "AMPHeadPoseEstimator.h"
#import <opencv2/opencv.hpp>

@implementation AMPHeadPoseEstimator

+ (NSDictionary *)estimatePoseWithImagePoints:(NSArray<NSValue *> *)imagePoints
                                     imgWidth:(double)imgWidth
                                    imgHeight:(double)imgHeight {
  if (imagePoints.count < 6 || imgWidth <= 0 || imgHeight <= 0) {
    return @{@"yaw": @(0.0), @"pitch": @(0.0), @"roll": @(0.0)};
  }

  std::vector<cv::Point2d> imgPts;
  for (int i = 0; i < 6; i++) {
    CGPoint p = [imagePoints[i] CGPointValue];
    imgPts.emplace_back(p.x, p.y);
  }

  std::vector<cv::Point3d> objPts;
  objPts.emplace_back(0.0, 0.0, 0.0);         // nose tip
  objPts.emplace_back(0.0, -63.6, -12.5);     // chin
  objPts.emplace_back(-43.3, 32.7, -26.0);    // left eye outer
  objPts.emplace_back(43.3, 32.7, -26.0);     // right eye outer
  objPts.emplace_back(-28.9, -28.9, -24.1);   // left mouth
  objPts.emplace_back(28.9, -28.9, -24.1);    // right mouth

  double focal = imgWidth;
  cv::Mat cameraMatrix = (cv::Mat_<double>(3, 3) <<
    focal, 0, imgWidth / 2.0,
    0, focal, imgHeight / 2.0,
    0, 0, 1.0
  );
  cv::Mat distCoeffs = cv::Mat::zeros(4, 1, CV_64FC1);
  cv::Mat rvec, tvec;
  bool ok = cv::solvePnP(objPts, imgPts, cameraMatrix, distCoeffs, rvec, tvec, false, cv::SOLVEPNP_ITERATIVE);
  if (!ok) {
    return @{@"yaw": @(0.0), @"pitch": @(0.0), @"roll": @(0.0)};
  }

  cv::Mat rot;
  cv::Rodrigues(rvec, rot);

  double r00 = rot.at<double>(0,0);
  double r10 = rot.at<double>(1,0);
  double r20 = rot.at<double>(2,0);
  double r21 = rot.at<double>(2,1);
  double r22 = rot.at<double>(2,2);

  double yaw = atan2(r21, r22) * 180.0 / M_PI;
  double pitch = atan2(-r20, sqrt(r21 * r21 + r22 * r22)) * 180.0 / M_PI;
  double roll = atan2(r10, r00) * 180.0 / M_PI;

  return @{@"yaw": @(yaw), @"pitch": @(pitch), @"roll": @(roll)};
}

@end
