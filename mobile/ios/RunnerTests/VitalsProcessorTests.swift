import XCTest
@testable import Runner

class VitalsProcessorTests: XCTestCase {
    var processor: VitalsProcessor!

    override func setUp() {
        super.setUp()
        processor = VitalsProcessor()
    }

    func testResultInitialization() {
        let result = processor.stopCollection()
        XCTAssertNotNil(result["forehead"])
        XCTAssertNotNil(result["left_cheek"])
        XCTAssertNotNil(result["right_cheek"])
    }

    func testCollectionCycle() {
        processor.startCollection()
        // 本来はここにフレーム供給のモックを入れる
        let result = processor.stopCollection()
        XCTAssertNotNil(result)
    }
}
