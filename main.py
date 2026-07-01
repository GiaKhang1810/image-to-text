from flask import Flask, Response, cli, render_template, request, jsonify
from os import makedirs, remove
from os.path import join, exists
from uuid import uuid4
from werkzeug.utils import secure_filename
from process import Process
from util import create_log

processor = Process()
UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
log = create_log(name=__name__)

cli.show_server_banner = lambda *args, **kwargs: None
server = Flask(import_name=__name__)


@server.after_request
def aft(response: Response) -> Response:
    log.info(
        f"{request.method} {request.remote_addr}: {request.path} {response.status_code}"
    )

    return response


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@server.route("/image-to-text", methods=["POST"])
def uploadfile():
    makedirs(UPLOAD_FOLDER, exist_ok=True)

    if "image" not in request.files:
        return jsonify({"status": 400, "message": "Không tìm thấy file ảnh."}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"status": 400, "message": "Tên file không hợp lệ."}), 400

    if not allowed_file(file.filename):
        return jsonify(
            {"status": 400, "message": "Chỉ hỗ trợ ảnh PNG, JPG, JPEG hoặc WEBP."}
        ), 400

    original_name = secure_filename(file.filename)
    extension = original_name.rsplit(".", 1)[1].lower()
    temp_filename = f"{uuid4().hex}.{extension}"
    temp_path = join(UPLOAD_FOLDER, temp_filename)

    try:
        file.save(temp_path)

        image = processor.modify(
            image_path=temp_path, mode="background", threshold=0, name=None
        )

        text = processor.readtext(image)

        if not text.strip():
            return jsonify(
                {"status": 404, "message": "Không nhận dạng được chữ trong ảnh."}
            ), 404

        return jsonify({"status": 200, "message": text}), 200

    except Exception as error:
        return jsonify({"status": 500, "message": str(error)}), 500

    finally:
        if exists(temp_path):
            remove(temp_path)


@server.route("/", methods=["GET"])
def main() -> str:
    return render_template("main.html")


if __name__ == "__main__":
    print("=" * 30)
    log.info(msg="Port: 8080")
    log.info(msg="Host: 127.0.0.1")
    log.info(msg="URL: http://127.0.0.1:8080")
    print("=" * 30)

    server.run(
        host="127.0.0.1",
        port=8080,
        debug=False,
    )
