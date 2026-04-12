import { useEffect, useRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";

const VRMAvatar = ({
  modelPath = "/VRM/UniQwery.vrm",
  vrmaGestures = [],
  customAvatarRef,
  defaultGestureIndex = 0, // ✅ NEW
}) => {
  const containerRef = useRef(null);

  const actionsRef = useRef([]);
  const currentActionRef = useRef({ action: null, index: null });
  const mixerRef = useRef(null);

  // EXPOSE FUNCTION
  useImperativeHandle(customAvatarRef, () => ({
    switchGesture: (gestureIndex) => {
      const action = actionsRef.current[gestureIndex];

      if (!action) {
        console.warn(`Action ${gestureIndex} not loaded yet.`);
        return;
      }

      if (currentActionRef.current.index === gestureIndex) return;

      if (currentActionRef.current.action) {
        currentActionRef.current.action.fadeOut(0.25);
      }

      action.reset().fadeIn(0.25).play();

      currentActionRef.current = { action, index: gestureIndex };
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    let scene, camera, renderer, vrm, clock;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    clock = new THREE.Clock();

    // SCENE
    scene = new THREE.Scene();
    scene.background = null;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // ✅ BIGGER AVATAR (IMPORTANT FIX)
    camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20);
    camera.position.set(0, 1.35, 6.5); // 👈 closer = bigger avatar

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // CONTROLS (locked)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.4, 0);
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.update();

    // LIGHTING
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(1, 2, 3);
    scene.add(dirLight);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));

    // LOAD MODEL
    loader.load(modelPath, (gltf) => {
      vrm = gltf.userData.vrm;

      VRMUtils.removeUnnecessaryJoints(vrm.scene);
      scene.add(vrm.scene);

      const mixer = new THREE.AnimationMixer(vrm.scene);
      mixerRef.current = mixer;

      const vrmaLoader = new GLTFLoader();
      vrmaLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));

      vrmaGestures.forEach((gesturePath, i) => {
        vrmaLoader.load(gesturePath, (vrmaGltf) => {
          const vrmAnimation = vrmaGltf.userData.vrmAnimations?.[0];
          if (!vrmAnimation) return;

          const clip = createVRMAnimationClip(vrmAnimation, vrm);
          const action = mixer.clipAction(clip);

          action.setLoop(THREE.LoopRepeat);

          actionsRef.current[i] = action;

          // ✅ TRUE DEFAULT ANIMATION (Wave or chosen index)
          if (i === defaultGestureIndex) {
            action.play();
            currentActionRef.current = { action, index: i };
          }
        });
      });
    });

    // LOOP
    const animate = () => {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();

      if (mixerRef.current) mixerRef.current.update(delta);
      if (vrm) vrm.update(delta);

      renderer.render(scene, camera);
    };

    animate();

    // RESIZE
    const handleResize = () => {
      if (!containerRef.current) return;

      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      scene.clear();
    };
  }, [modelPath, vrmaGestures, defaultGestureIndex]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex justify-center items-center"
    />
  );
};

export default VRMAvatar;