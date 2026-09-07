import { HomeView } from "./_components/home-view"

/**
 * Input: Không nhận props.
 * Output: Lối vào app. File này chỉ còn là cái vỏ để Next có một route `/`; toàn bộ việc quyết
 *         định đi đâu do `HomeView` làm ở client (xem file đó).
 *
 *         Không còn fetch ở server: danh sách tổ chức đã do SessionGate tải sẵn nên `HomeView`
 *         đọc từ cache, không thêm request nào.
 */
export default function HomePage() {
  return <HomeView />
}
