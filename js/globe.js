let globeObj = (function () {
    'use strict';

    // 判断浏览器是否支持webgl
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    let container, stats;
    let camera, scene, renderer;
    let group;
    let satellites = [];
    let controls;
    let winWth = window.innerWidth,
        winHgt = window.innerHeight;

    // 获取position
    function getPosition(lng, lat, alt) {
        let phi = (90 - lat) * (Math.PI / 180),
            theta = (lng + 180) * (Math.PI / 180),
            radius = alt + 200,
            x = -(radius * Math.sin(phi) * Math.cos(theta)),
            z = radius * Math.sin(phi) * Math.sin(theta),
            y = radius * Math.cos(phi);
        return {x: x, y: y, z: z};
    }

    // 地球
    function drawGlobe() {
        let globeTextureLoader = new THREE.TextureLoader();
        globeTextureLoader.load('http://127.0.0.1/earth.jpg', function (
            texture
        ) {
            let globeGgeometry = new THREE.SphereGeometry(90, 60, 60, 0);
            let globeMaterial = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: texture
            });
            let globeMesh = new THREE.Mesh(globeGgeometry, globeMaterial);
            let satellite = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: new THREE.CanvasTexture(generateSprite('255,255,255')),
                    blending: THREE.AdditiveBlending
                })
            );

            satellite.scale.x = satellite.scale.y = satellite.scale.z = 255;
            group.add(satellite); //添加发光,让地球有发光的样式,模拟大气层
            group.add(globeMesh);
            group.rotation.x = THREE.Math.degToRad(35);
            group.rotation.y = THREE.Math.degToRad(170);
        });
    }

    // 卫星
    function drawSatellite() {
        satellites.push(initSatellite(3, 128, {x: -Math.PI * 0.35, y: Math.PI * 0.25, z: 0}, 0.001, group));
        satellites.push(initSatellite(3, 111, {x: -Math.PI * 0.35, y: -Math.PI * 0.2, z: 0}, 0.002, group));
        satellites.push(initSatellite(3, 179, {x: -Math.PI * 0.35, y: Math.PI * 0.05, z: 0}, 0.003, group));
    }

    /**
     * @param color 颜色的r,g和b值,比如：“123,123,123”;
     * @returns {Element} 返回canvas对象
     */
    let generateSprite = function (color) {
        let canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        let context = canvas.getContext('2d');
        let gradient = context.createRadialGradient(
            canvas.width / 2,
            canvas.height / 2,
            0,
            canvas.width / 2,
            canvas.height / 2,
            canvas.width / 2
        );
        gradient.addColorStop(0, 'rgba(' + color + ',1)');
        gradient.addColorStop(0.2, 'rgba(' + color + ',1)');
        gradient.addColorStop(0.4, 'rgba(' + color + ',.1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        return canvas;
    };
    /**
     * 返回一个卫星和轨道的组合体
     * @param satelliteSize 卫星的大小
     * @param satelliteRadius 卫星的旋转半径
     * @param rotation 组合体的x,y,z三个方向的旋转角度
     * @param speed 卫星运动速度
     * @param scene 场景
     * @returns {{satellite: THREE.Mesh, speed: *}} 卫星组合对象;速度
     */
    let initSatellite = function (satelliteSize, satelliteRadius, rotation, speed, scene) {
        // 轨迹
        let track = new THREE.Mesh(
            new THREE.RingGeometry(satelliteRadius, satelliteRadius + 0.2, 100, 8),
            new THREE.MeshBasicMaterial()
        );
        let objLoader = new THREE.OBJLoader();
        let mtlLoader = new THREE.MTLLoader();
        let centerMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 1, 1), new THREE.MeshLambertMaterial()); //材质设定

        let pivotPoint = new THREE.Group();
        mtlLoader.load('http://127.0.0.1/earth_n/Satellite.mtl', function (material) {
            let satellite = objLoader.load('http://127.0.0.1/earth_n/Satellite.obj', function (loadedMesh) {
                objLoader.setMaterials(material);
                loadedMesh.scale.set(satelliteSize, satelliteSize, satelliteSize);
                loadedMesh.position.set(satelliteRadius, 0, 0);
                loadedMesh.traverse(function (child) {
                    if (child instanceof THREE.Mesh) {
                        //设置模型皮肤
                        child.material.map = THREE.ImageUtils.loadTexture('http://127.0.0.1/earth_n/satellite_Satélite_BaseColor.jpg');
                    }
                });
                pivotPoint.add(loadedMesh);
            })
        });
        pivotPoint.add(track);
        centerMesh.add(pivotPoint);
        // 轨道倾角
        centerMesh.rotation.set(rotation.x, rotation.y, rotation.z);
        scene.add(centerMesh);
        return {satellite: centerMesh, speed: speed};
    };

    // 星空背景
    function stars() {
        let starsGeometry = new THREE.Geometry();
        for (let i = 0; i < 1211; i++) {
            let starVector = new THREE.Vector3(
                THREE.Math.randFloatSpread(2000),
                THREE.Math.randFloatSpread(2000),
                THREE.Math.randFloatSpread(2000)
            );
            starsGeometry.vertices.push(starVector);
        }
        let starsMaterial = new THREE.PointsMaterial({color: 0x00FFFFFF});
        let starsPoint = new THREE.Points(starsGeometry, starsMaterial);
        group.add(starsPoint);
    }

    // 光
    function lights() {
        let hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x088888, 2);
        hemisphereLight.position.x = 0;
        hemisphereLight.position.y = 1000;
        hemisphereLight.position.z = 200;
        group.add(hemisphereLight);
    }

    // 初始化场景
    function initScene() {
        //给场景添加天空盒子纹理
        let cubeTextureLoader = new THREE.CubeTextureLoader();
        cubeTextureLoader.setPath('/earth_n/skybox/');
        //朝前的（posz）、朝后的（negz）、朝上的（posy）、朝下的（negy）、朝右的（posx）和朝左的（negx）！！
        let cubeTexture = cubeTextureLoader.load([
            'px.jpg', 'nx.jpg',
            'py.jpg', 'ny.jpg',
            'pz.jpg', 'nz.jpg'
        ]);
        scene = new THREE.Scene();
        scene.background = cubeTexture;
        container = document.getElementById('earth_container');
        // 透视投影
        camera = new THREE.PerspectiveCamera(45, winWth / winHgt, 1, 2000);
        camera.up.x = 0;
        camera.up.y = 1;
        camera.up.z = 0;
        camera.position.x = 0;
        camera.position.y = 0;
        camera.position.z = 400;
        camera.lookAt(new THREE.Vector3(0, 0, 0));
        group = new THREE.Group();
        scene.add(group);
    }

    //用户交互插件 鼠标左键按住旋转，右键按住平移，滚轮缩放

    function initControls() {

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        //设置控制器的中心点
        controls.target.set(0, 5, 0);
        // 使动画循环使用时阻尼或自转 意思是否有惯性
        controls.enableDamping = true;
        //动态阻尼系数 就是鼠标拖拽旋转灵敏度
        controls.dampingFactor = 0.25;
        //是否可以缩放
        controls.enableZoom = true;
        //是否自动旋转
        controls.autoRotate = false;
        controls.autoRotateSpeed = 0.5;
        //设置相机距离原点的最远距离
        controls.minDistance = 1;
        //设置相机距离原点的最远距离
        controls.maxDistance = 500;
        //是否开启右键拖拽
        controls.enablePan = true;
    }


    function initRender() {
        renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(winWth, winHgt);
        // 盘旋控制
        let orbitControl = new THREE.OrbitControls(camera, renderer.domElement);
        // 限制镜头距离
        orbitControl.maxDistance = 1000;
        orbitControl.minDistance = 300;
        container.appendChild(renderer.domElement);
        // 性能测试
        stats = new Stats();
        $(container).append(stats.domElement);
    }

    // 初始化
    function init() {
        initScene();
        // 地球
        drawGlobe();
        //卫星
        drawSatellite();
        // 星点
        stars();
        // 半球光
        lights();
        // 渲染器
        initRender();
        //
        initControls();
        animate();
        // resize事件
        window.addEventListener('resize', onWindowResize, false);
    }

    // 改变窗口大小触发
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // 渲染
    function render() {
        group.rotation.y += 0.001;
        renderer.render(scene, camera);
        // 卫星移动
        for (let i = 0; i < satellites.length; i++) {
            satellites[i].satellite.rotation.z -= satellites[i].speed;
        }
    }

    // 动画
    function animate() {
        render();
        controls.update();
        stats.update();
        requestAnimationFrame(animate);
    }

    init();
})();
