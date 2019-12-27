function updateLikes() {
  id = $(".likeicon").attr("secretId");
  $.post("/secrets/" + id, function(response) {
    $("#likeCount").text(response.likeCount); // update likes with response
  });

  document
    .getElementsByClassName("fa-heart")[0]
    .classList.toggle("heart-filled");
}
