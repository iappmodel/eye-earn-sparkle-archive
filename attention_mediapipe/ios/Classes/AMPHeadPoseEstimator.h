#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

NS_ASSUME_NONNULL_BEGIN

@interface AMPHeadPoseEstimator : NSObject

+ (NSDictionary *)estimatePoseWithImagePoints:(NSArray<NSValue *> *)imagePoints
                                     imgWidth:(double)imgWidth
                                    imgHeight:(double)imgHeight;

@end

NS_ASSUME_NONNULL_END
