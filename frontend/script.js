const imageInput = document.getElementById("imageInput");
const previewImage = document.getElementById("previewImage");

imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];

    if(file){
        previewImage.src = URL.createObjectURL(file);
    }
});

async function runOCR(){

    const file = imageInput.files[0];

    if(!file){
        alert("Vui lòng chọn ảnh");
        return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try{

        const response = await fetch(
            "dia chi server",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        document.getElementById("result").value =
            data.text;

    }
    catch(error){
        console.error(error);
        alert("Lỗi kết nối server");
    }
}
