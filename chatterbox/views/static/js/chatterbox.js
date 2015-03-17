var cb = angular.module('Chatterbox', []);

cb.controller('Room', ['$scope', '$sce', function($scope, $sce){
    $scope.room = new Room('Foo', ws_url);

    $scope.room.onme = function(me){
        $scope.me = me;
        $scope.$apply();
    }

    $scope.room.onclient = function(client){
        console.log("NEW CLIENT", client);
        var vid = document.getElementById(client.dom_id);
        vid.src = client.stream;
        $scope.$apply();
    }

    $scope.vid_constraints = {
        mandatory: {
            maxHeight: 180,
            maxWidth: 320
        }
    };

    $scope.constraints = { audio: true, video: vid_constraints };

    $scope.connect = function(evt){
        $scope.get_user_media();
    }

    $scope.user_media_error = function(evt){
        console.log(evt);
    };

    $scope.handle_user_media = function(stream){
        local_stream = stream;
        me.onaddstream({stream:stream});
        if(me.pc) me.pc.addStream(stream);
    };

    $scope.get_user_media = function(){
        getUserMedia(constraints, $scope.handle_user_media, $scope.user_media_error);
    };
}]);
