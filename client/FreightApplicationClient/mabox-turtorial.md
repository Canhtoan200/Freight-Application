HUONG DAN SET TOKEN MAPBOX NHA

MAPBOX CAN 2 API KEY (PRIVATE + PUBLIC)

PRIVATE SET TRONG client\FreightApplicationClient\android\gradle.properties
RNMAPBOX_MAPS_DOWNLOAD_TOKEN=

PUBLIC SET TRONG .env
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=

Giờ mình lên website của mapbox sẽ thấy 2 loại api key, default public có sẵn
mình tạo thêm PRIVATE
Tại sao lại có 2 loại (vì mobile app sẽ lấy được token, nên ngta tạo 1 public và 1 private)

nó khác với cơ chế của web chỉ cần 1 api key là đủ

Ngoài ra
Bạn cần cài thêm 2 thư viện này bỏ vào app.json (dòng 35-48)
link hướng dẫn: https://rnmapbox.github.io/docs/install?configure-module=expo
expo install @rnmapbox/maps

